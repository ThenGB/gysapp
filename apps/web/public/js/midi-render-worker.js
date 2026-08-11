/* GYSApp MIDI render worker (classic). Kontrak:
 * IN  : { type:'init' }
 *       { type:'loadSoundFont', id, url, buffer }   buffer: ArrayBuffer
 *       { type:'render', id, midiBuffer, sampleRate, transpose, instrument, tempoRate }
 * OUT : { type:'ready' }
 *       { type:'sfLoaded', id, presets:[[program,name]] }
 *       { type:'rendered', id, left, right, sampleRate, duration }  (transferable)
 *       { type:'error', id, error }
 * SoundFont di-cache IndexedDB (gys-sf-cache) — tidak pernah dobel di Cache API.
 */
self.importScripts('/vendor/libfluidsynth-2.4.6.js');
self.importScripts('/vendor/js-synthesizer.min.js');

var SF_DB = 'gys-sf-cache';
var SF_STORE = 'soundfonts';
var synth = null;
var engineReady = false;
var CHUNK = 8192;
var SILENCE_STOP_S = 2;
var TAIL_S = 2;
var MAX_DURATION_S = 1200;
var NORMALIZE_TARGET = 0.94;

JSSynth.waitForReady().then(function () {
  engineReady = true;
  postMessage({ type: 'ready' });
});

function openDb() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(SF_DB, 1);
    req.onupgradeneeded = function (e) {
      if (!e.target.result.objectStoreNames.contains(SF_STORE)) {
        e.target.result.createObjectStore(SF_STORE);
      }
    };
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error || new Error('indexeddb open failed'));
    };
  });
}

function getSf(url) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(SF_STORE, 'readonly');
      var req = tx.objectStore(SF_STORE).get(url);
      req.onsuccess = function () {
        resolve(req.result || null);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  });
}

function putSf(url, buffer) {
  return openDb().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(SF_STORE, 'readwrite');
      tx.objectStore(SF_STORE).put(buffer, url);
      tx.oncomplete = resolve;
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  });
}

function ensureSynth(sampleRate) {
  if (synth) return Promise.resolve(synth);
  synth = new JSSynth.Synthesizer();
  synth.init(sampleRate);
  return Promise.resolve(synth);
}

function extractPresets() {
  var presets = [];
  for (var p = 0; p < 128; p++) {
    var name = synth.getPresetName(0, p);
    if (name) presets.push([p, name]);
  }
  return presets;
}

self.onmessage = function (e) {
  var msg = e.data;
  if (msg.type === 'init') {
    if (engineReady) postMessage({ type: 'ready' });
    return;
  }
  if (msg.type === 'loadSoundFont') {
    getSf(msg.url)
      .then(function (cached) {
        if (cached) return cached;
        var copy = msg.buffer.slice(0);
        return putSf(msg.url, copy).then(function () {
          return copy;
        });
      })
      .then(function (buffer) {
        return ensureSynth(48000).then(function () {
          return synth.loadSFont(buffer);
        });
      })
      .then(function () {
        postMessage({ type: 'sfLoaded', id: msg.id, presets: extractPresets() });
      })
      .catch(function (err) {
        postMessage({ type: 'error', id: msg.id, error: String((err && err.message) || err) });
      });
    return;
  }
  if (msg.type === 'render') {
    renderMidi(msg);
    return;
  }
};

function renderMidi(msg) {
  ensureSynth(msg.sampleRate || 48000)
    .then(function () {
      var copy = msg.midiBuffer.slice(0);
      return synth.addSMFDataToPlayer(copy);
    })
    .then(function () {
      return synth.playPlayer();
    })
    .then(function () {
      var sampleRate = msg.sampleRate || 48000;
      var leftParts = [];
      var rightParts = [];
      var peak = 0;
      var silentS = 0;
      var hadSignal = false;
      var totalFrames = 0;

      var renderChunk = function () {
        if (totalFrames >= sampleRate * MAX_DURATION_S) return Promise.resolve();
        var left = new Float32Array(CHUNK);
        var right = new Float32Array(CHUNK);
        synth.render([left, right]);
        var chunkPeak = 0;
        for (var i = 0; i < CHUNK; i++) {
          var v = Math.abs(left[i]);
          if (v > chunkPeak) chunkPeak = v;
        }
        if (chunkPeak > peak) peak = chunkPeak;
        if (chunkPeak > 0.0001) {
          hadSignal = true;
          silentS = 0;
        } else if (hadSignal) {
          silentS += CHUNK / sampleRate;
        }
        leftParts.push(left);
        rightParts.push(right);
        totalFrames += CHUNK;
        if (hadSignal && silentS >= SILENCE_STOP_S) return Promise.resolve();
        return renderChunk();
      };

      return renderChunk().then(function () {
        // Tail reverb singkat.
        var tail = Math.floor(sampleRate * TAIL_S);
        if (totalFrames < sampleRate * MAX_DURATION_S) {
          var tLeft = new Float32Array(tail);
          var tRight = new Float32Array(tail);
          synth.render([tLeft, tRight]);
          leftParts.push(tLeft);
          rightParts.push(tRight);
          totalFrames += tail;
        }

        // Normalisasi puncak ke 0.94 (boost maks 8x, kontrak gyschordweb).
        var gain = 1;
        if (peak > 0) {
          gain = Math.min(8, NORMALIZE_TARGET / peak);
        }
        if (Math.abs(gain - 1) > 1e-4) {
          for (var p = 0; p < leftParts.length; p++) {
            var l = leftParts[p];
            var r = rightParts[p];
            for (var i = 0; i < l.length; i++) {
              l[i] *= gain;
              r[i] *= gain;
            }
          }
        }

        // Trim silent trailing.
        var trimThreshold = 0.0001;
        var last = totalFrames;
        for (var i = leftParts.length - 1; i >= 0; i--) {
          var lc = leftParts[i];
          var silent = true;
          for (var j = lc.length - 1; j >= 0; j--) {
            if (Math.abs(lc[j]) > trimThreshold) {
              silent = false;
              break;
            }
          }
          if (silent) last -= lc.length;
          else break;
        }

        var leftOut = new Float32Array(last);
        var rightOut = new Float32Array(last);
        var offset = 0;
        for (var i = 0; i < leftParts.length && offset < last; i++) {
          var chunk = leftParts[i];
          var n = Math.min(chunk.length, last - offset);
          leftOut.set(chunk.subarray(0, n), offset);
          rightOut.set(rightParts[i].subarray(0, n), offset);
          offset += n;
        }

        var buffers = [leftOut.buffer, rightOut.buffer];
        postMessage(
          {
            type: 'rendered',
            id: msg.id,
            left: leftOut,
            right: rightOut,
            sampleRate: sampleRate,
            duration: last / sampleRate,
          },
          buffers,
        );
      });
    })
    .catch(function (err) {
      postMessage({ type: 'error', id: msg.id, error: String((err && err.message) || err) });
    });
}
