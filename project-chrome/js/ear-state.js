// DOM・Three.jsに依存しない耳モデルの読込状態。
export const EAR_NODE_NAMES = ['EarLeft', 'EarRight'];

export function createEarMaterialControls(source, { led = false } = {}) {
  const shells = new Set(), leds = new Set();
  source.traverse(node => {
    for (const material of [node.material].flat().filter(Boolean)) {
      if (material.name === 'EarShell') shells.add(material);
      if (material.name === 'EarLED') leds.add(material);
    }
  });
  if (!shells.size) throw new Error('EarShell materialがありません');
  if (led && !leds.size) throw new Error('EarLED materialがありません');
  return {
    applyColor(color) { shells.forEach(material => material.color.set(color)); },
    applyLED(color, enabled) {
      leds.forEach(material => {
        material.color.set(enabled ? color : '#222027');
        material.emissive.set(color);
        material.emissiveIntensity = enabled ? 1.25 : 0;
      });
    },
  };
}

export function findEarNodes(root) {
  const nodes = EAR_NODE_NAMES.map(name => {
    const matches = [];
    root.traverse(node => { if (node.name === name) matches.push(node); });
    if (matches.length !== 1) throw new Error(`${name} は一つ必要です`);
    return matches[0];
  });
  for (const node of nodes) {
    let meshes = 0;
    node.traverse(child => { if (child.isMesh) meshes++; });
    if (!meshes) throw new Error(`${node.name} にMeshがありません`);
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (nodes.includes(parent)) throw new Error('左右の耳は独立したnodeにしてください');
    }
  }
  return nodes;
}

export function createEarController({ load, onChange = () => {}, onError = () => {} }) {
  let enabled = false, loading = false, asset = null, generation = 0, modelId = 'glb';
  let pending = Promise.resolve();
  function setEnabled(value, id = modelId) {
    if (id !== modelId) {
      generation++; loading = false;
      asset?.dispose(); asset = null;
      modelId = id;
    }
    enabled = Boolean(value);
    if (!enabled) {
      // RESET/OFF前の完了が現在の装備を変更しない。
      if (loading) { generation++; loading = false; }
      onChange();
      return pending;
    }
    if (asset || loading) { onChange(); return pending; }
    const request = ++generation;
    loading = true;
    onChange();
    const requestedId = modelId;
    pending = Promise.resolve().then(() => load(requestedId)).then(result => {
      if (request !== generation) { result.dispose(); return; }
      asset = result;
      loading = false;
      onChange();
    }).catch(error => {
      if (request !== generation) return;
      loading = false;
      onError(error);
      onChange();
    });
    return pending;
  }
  return {
    setEnabled,
    reset() { return setEnabled(false); },
    dispose() {
      enabled = false; loading = false; generation++;
      asset?.dispose(); asset = null;
    },
    get asset() { return asset; },
    get enabled() { return enabled; },
    get loading() { return loading; },
  };
}
