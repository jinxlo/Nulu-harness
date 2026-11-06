#!/usr/bin/env bash
set -euo pipefail

# Ubuntu's package transaction scans the hosted image's full dpkg database and
# runs post-install hooks. CI needs only the signed-archive payload, so pin and
# verify that payload before extracting it into the ephemeral runner directory.
readonly BUBBLEWRAP_VERSION='0.9.0-1ubuntu0.3'
readonly BUBBLEWRAP_SHA256='2461f1beee9cb04c8942739fe1a2b37e7b7c2a3d518f0779dc75f9245baa3094'
# A dated snapshot retains the exact payload when Ubuntu replaces its live pool; Launchpad and the
# live pool serve the same file while it is current. The pinned checksum decides which bytes are accepted.
readonly BUBBLEWRAP_FILE="bubblewrap_${BUBBLEWRAP_VERSION}_amd64.deb"
readonly BUBBLEWRAP_URLS=(
  "https://snapshot.ubuntu.com/ubuntu/20261101T000000Z/pool/main/b/bubblewrap/${BUBBLEWRAP_FILE}"
  "https://launchpad.net/ubuntu/+archive/primary/+files/${BUBBLEWRAP_FILE}"
  "http://archive.ubuntu.com/ubuntu/pool/main/b/bubblewrap/${BUBBLEWRAP_FILE}"
)

: "${RUNNER_TEMP:?prepare-ci-bubblewrap requires RUNNER_TEMP}"
: "${GITHUB_PATH:?prepare-ci-bubblewrap requires GITHUB_PATH}"

if [[ "$(uname -s)" != 'Linux' || "$(uname -m)" != 'x86_64' ]]; then
  echo 'prepare-ci-bubblewrap supports only Linux x86_64 hosted runners' >&2
  exit 1
fi

archive="${RUNNER_TEMP}/bubblewrap_${BUBBLEWRAP_VERSION}_amd64.deb"
root="${RUNNER_TEMP}/nulu-bubblewrap"

downloaded=0
for url in "${BUBBLEWRAP_URLS[@]}"; do
  if curl --fail --silent --show-error --location --retry 2 --retry-all-errors --output "$archive" "$url" \
    && printf '%s  %s\n' "$BUBBLEWRAP_SHA256" "$archive" | sha256sum --check --status; then
    downloaded=1
    break
  fi
  echo "bubblewrap payload unavailable or different at $url" >&2
done
[[ "$downloaded" == 1 ]] || { echo 'no source served the pinned bubblewrap payload' >&2; exit 1; }
mkdir -p "$root"
dpkg-deb --extract "$archive" "$root"
printf '%s\n' "$root/usr/bin" >> "$GITHUB_PATH"

sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0 \
  || echo 'apparmor userns knob absent — the functional probe decides'
"$root/usr/bin/bwrap" --version
"$root/usr/bin/bwrap" --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent -- true
echo 'bubblewrap functional probe passed'
