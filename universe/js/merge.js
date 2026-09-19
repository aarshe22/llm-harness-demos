/* Merge static voxel meshes of a group into one mesh per unique material,
   pruning any subtree flagged userData.noMerge. Keeps time-aware materials
   alive (merged mesh shares the same material instance). Skips sprites,
   instanced/points/shader/transparent/textured materials. */
(function () {
  'use strict';
  var VC = window.VC;
  var _v = new THREE.Vector3();
  var _n = new THREE.Vector3();

  VC.mergeVoxelGroup = function (group) {
    group.updateMatrixWorld(true);
    var inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    var buckets = new Map();
    (function walk(o) {
      for (var i = 0; i < o.children.length; i++) {
        var c = o.children[i];
        if (c.userData && c.userData.noMerge) continue;
        if (c.isMesh && !c.isInstancedMesh && c.name !== 'merged') {
          var mt = c.material;
          if (!mt.map && !mt.alphaMap && !mt.transparent && !mt.isShaderMaterial) {
            if (!buckets.has(mt)) buckets.set(mt, []);
            buckets.get(mt).push(c);
          }
        }
        walk(c);
      }
    })(group);
    var toRemove = [];
    buckets.forEach(function (parts, mt) {
      if (parts.length < 3) return;
      var pos = [], nrm = [], col = [], idx = [], vOff = 0;
      var c = new THREE.Color();
      parts.forEach(function (m) {
        var g = m.geometry;
        var p = g.getAttribute('position'), n = g.getAttribute('normal'), ix = g.index;
        if (!p || vOff + p.count > 65000) return;
        var mat4 = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
        var nMat = new THREE.Matrix3().getNormalMatrix(mat4);
        c.copy(mt.color);
        if (mt.emissive) {
          c.r = Math.min(1, c.r + mt.emissive.r);
          c.g = Math.min(1, c.g + mt.emissive.g);
          c.b = Math.min(1, c.b + mt.emissive.b);
        }
        var va = p.count;
        for (var i = 0; i < va; i++) {
          _v.fromBufferAttribute(p, i).applyMatrix4(mat4);
          pos.push(_v.x, _v.y, _v.z);
          if (n) { _n.fromBufferAttribute(n, i).applyMatrix3(nMat).normalize(); nrm.push(_n.x, _n.y, _n.z); }
          else { nrm.push(0, 1, 0); }
          col.push(c.r, c.g, c.b);
        }
        if (ix) { for (var j = 0; j < ix.count; j++) idx.push(ix.getX(j) + vOff); }
        else { for (var k = 0; k < va; k++) idx.push(k + vOff); }
        vOff += va;
      });
      if (!pos.length) return;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      var nm;
      if (mt.isMeshPhongMaterial) nm = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: mt.shininess || 30 });
      else nm = new THREE.MeshLambertMaterial({ vertexColors: true });
      nm.emissive = new THREE.Color(0, 0, 0);
      if (mt.userData && mt.userData.isTime) {
        nm.userData.dayEm = new THREE.Color(0x1a1408);
        nm.userData.nightEm = mt.userData.nightEm;
        nm.userData.baseColor = new THREE.Color(0.86, 0.86, 0.86);
        nm.userData.boostColor = true;
        nm.userData.maxLevel = mt.userData.maxLevel;
        nm.userData.isTime = true;
        VC.timeMats.nightTinted = VC.timeMats.nightTinted || [];
        VC.timeMats.nightTinted.push(nm);
      }
      group.add(new THREE.Mesh(geo, nm));
      parts.forEach(function (m) { toRemove.push(m); });
    });
    toRemove.forEach(function (m) { if (m.parent) m.parent.remove(m); });
    return group;
  };
})();
