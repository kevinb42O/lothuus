import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { ENTRY_VIDEO_SIZE, entryVideoProjection, entryVideoSource } from './entry-video';
import { houseEntryFraming } from '@/components/house-entry';
import { HouseCameraRig } from '@/components/house-camera';

test('the lightweight video projection matches the original 3D camera throughout the take', () => {
  for (const source of Object.values(ENTRY_VIDEO_SIZE)) {
    const camera = new T.PerspectiveCamera(houseEntryFraming(source.width, source.height).fov, source.width / source.height, .04, 360);
    const target = new T.Vector3(), rig = new HouseCameraRig(camera, target);
    rig.frameEntry(houseEntryFraming(source.width, source.height).yaw);
    for (let frame = 0; frame <= 140; frame++) {
      const progress = frame / 140;
      rig.scrollTo(progress, true); camera.lookAt(target); camera.updateMatrixWorld(true);
      const expected = new T.Vector3(0, 2.03, -6).project(camera);
      const actual = entryVideoProjection(progress, source.width, source.height, source);
      assert.ok(Math.abs(actual.x - expected.x * source.width / 2) < 1e-8);
      assert.ok(Math.abs(actual.y + expected.y * source.height / 2) < 1e-8);
      assert.ok(actual.scale > 0 && actual.scale <= 1);
    }
  }
});

test('alpha video uses HEVC on Apple browsers and WebM on other browsers', () => {
  for (const userAgent of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  ]) assert.equal(entryVideoSource({ userAgent, maxTouchPoints: 0 }, true), '/house/video/entrance-mobile.mov');
  for (const userAgent of [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 Firefox/132.0',
  ]) assert.equal(entryVideoSource({ userAgent, maxTouchPoints: 0 }, false), '/house/video/entrance-desktop.webm');
  assert.equal(entryVideoSource({ userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15', maxTouchPoints: 5 }, true), '/house/video/entrance-mobile.mov');
});
