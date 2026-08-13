#!/usr/bin/env bash
set -euo pipefail
sed -i "s/vi\.fn()\.mockResolvedValue<NotificationPermission>('granted')/vi.fn().mockResolvedValue('granted' as NotificationPermission)/" apps/web/src/platform/scheduled-notifications.test.ts
