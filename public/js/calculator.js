import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

const DEFAULT_TEXT = 'КОФЕЙНЯ';
const MAX_TEXT_LENGTH = 20;
const MM_TO_UNITS = 0.01;

const FONT_PRESETS = {
  notoSansBold: {
    regular: '/assets/fonts/arial-bold.ttf',
    bold: '/assets/fonts/arial-bold.ttf',
    label: 'Noto Sans Bold'
  },
  nunitoBlack: {
    regular: '/assets/fonts/arial-black.ttf',
    bold: '/assets/fonts/arial-black.ttf',
    label: 'Nunito Black'
  },
  onestExtraBold: {
    regular: '/assets/fonts/verdana-bold.ttf',
    bold: '/assets/fonts/verdana-bold.ttf',
    label: 'Onest Extra Bold'
  },
  rubikBlack: {
    regular: '/assets/fonts/arial-black.ttf',
    bold: '/assets/fonts/arial-black.ttf',
    label: 'Rubik Black'
  },
  futuraRoundBold: {
    regular: '/assets/fonts/georgia-bold.ttf',
    bold: '/assets/fonts/georgia-bold.ttf',
    label: 'FuturaRoundBold'
  },
  interBlack: {
    regular: '/assets/fonts/arial-black.ttf',
    bold: '/assets/fonts/arial-black.ttf',
    label: 'Inter Black'
  },
  russoOne: {
    regular: '/assets/fonts/arial-black.ttf',
    bold: '/assets/fonts/verdana-bold.ttf',
    label: 'Russo One'
  }
};

const PRICE_CONFIG = {
  basePrice: 3800,
  pricePerCharacter: 430,
  pricePerHeightMm: 14,
  pricePerDepthMm: 24,
  materialMultiplier: {
    PLA: 1,
    PETG: 1.18,
    OTHER: 1.32
  },
  fontMultiplier: {
    notoSansBold: 1,
    nunitoBlack: 1.03,
    onestExtraBold: 1.05,
    rubikBlack: 1.06,
    futuraRoundBold: 1.07,
    interBlack: 1.09,
    russoOne: 1.08
  },
  lightingPrice: {
    none: 0,
    backlit: 3300,
    faceLit: 4700
  },
  mountingPrice: {
    undefined: 0,
    standoffs: 1400,
    base: 2300,
    other: 1700
  }
};

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function normalizeText(value) {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);

  return cleaned || DEFAULT_TEXT;
}

function formatRubles(value) {
  return `${new Intl.NumberFormat('ru-RU').format(value)} ₽`;
}

function roundToHundreds(value) {
  return Math.round(value / 100) * 100;
}

function materialStyle(material, colorHex) {
  const map = {
    PLA: { metalness: 0.08, roughness: 0.55 },
    PETG: { metalness: 0.16, roughness: 0.42 },
    OTHER: { metalness: 0.22, roughness: 0.5 }
  };

  const style = map[material] || map.PLA;
  return {
    color: new THREE.Color(colorHex),
    metalness: style.metalness,
    roughness: style.roughness
  };
}

export function calculatePrice(options) {
  const textLength = normalizeText(options.text).length;
  const height = clampNumber(options.height, 100, 1000, 300);
  const depth = clampNumber(options.depth, 20, 200, 60);
  const quantity = clampNumber(options.quantity, 1, 100, 1);

  const materialMultiplier = PRICE_CONFIG.materialMultiplier[options.material] || PRICE_CONFIG.materialMultiplier.PLA;
  const fontMultiplier = PRICE_CONFIG.fontMultiplier[options.font] || 1;
  const lightingPrice = PRICE_CONFIG.lightingPrice[options.lighting] || 0;
  const mountingPrice = PRICE_CONFIG.mountingPrice[options.mounting] || 0;

  const geometryCost =
    PRICE_CONFIG.basePrice +
    textLength * PRICE_CONFIG.pricePerCharacter +
    height * PRICE_CONFIG.pricePerHeightMm +
    depth * PRICE_CONFIG.pricePerDepthMm;

  const unitPrice = geometryCost * materialMultiplier * fontMultiplier + lightingPrice + mountingPrice;
  const totalPrice = roundToHundreds(unitPrice * quantity);

  return Math.max(1000, totalPrice);
}

class SignPreview3D {
  constructor(viewport, fallbackElement) {
    this.viewport = viewport;
    this.fallbackElement = fallbackElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.fontLoader = new FontLoader();
    this.ttfLoader = new TTFLoader();
    this.fontCache = new Map();
    this.meshGroup = null;
    this.floorMesh = null;
    this.backdropMesh = null;
    this.currentTextMesh = null;
    this.currentGlowMesh = null;
    this.currentBackGlowMesh = null;
    this.measurementGroup = null;
    this.currentDimensionTextures = [];
    this.currentBoundingSize = null;
    this.activeLightingMode = 'none';
    this.lastUpdateTimestamp = 0;
    this.frameId = null;
    this.resizeObserver = null;
    this.destroyed = false;
  }

  async init() {
    this.scene = new THREE.Scene();
    this.scene.background = null;

    const width = Math.max(320, this.viewport.clientWidth || 640);
    const height = Math.max(320, this.viewport.clientHeight || 420);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1500);
    this.camera.position.set(7, 4, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.renderer.setSize(width, height);
    this.viewport.innerHTML = '';
    this.viewport.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 120;

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff6df, 1.15);
    keyLight.position.set(6, 8, 10);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdde7ff, 0.75);
    fillLight.position.set(-8, 2, 6);
    this.scene.add(fillLight);

    this.floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 12),
      new THREE.MeshStandardMaterial({ color: 0x1d2a39, roughness: 0.86, metalness: 0.08 })
    );
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -1.65;
    this.floorMesh.position.z = -0.35;
    this.scene.add(this.floorMesh);

    this.backdropMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshStandardMaterial({
        color: 0x284869,
        roughness: 0.88,
        metalness: 0,
        transparent: true,
        opacity: 0.3
      })
    );
    this.backdropMesh.position.set(0, 2.2, -3.9);
    this.scene.add(this.backdropMesh);

    this.meshGroup = new THREE.Group();
    this.scene.add(this.meshGroup);

    this.measurementGroup = new THREE.Group();
    this.scene.add(this.measurementGroup);

    this.observeResize();
    this.animate();
  }

  observeResize() {
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderer || !this.camera) {
        return;
      }

      const width = Math.max(320, this.viewport.clientWidth || 640);
      const height = Math.max(320, this.viewport.clientHeight || 420);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });

    this.resizeObserver.observe(this.viewport);
  }

  async loadFont(fontFamily, fontWeight) {
    const family = FONT_PRESETS[fontFamily] || FONT_PRESETS.notoSansBold;
    const fontPath = family[fontWeight] || family.regular;

    if (this.fontCache.has(fontPath)) {
      return this.fontCache.get(fontPath);
    }

    const font = fontPath.toLowerCase().endsWith('.ttf')
      ? await new Promise((resolve, reject) => {
          this.ttfLoader.load(
            fontPath,
            (json) => {
              try {
                resolve(this.fontLoader.parse(json));
              } catch (parseError) {
                reject(parseError);
              }
            },
            undefined,
            reject
          );
        })
      : await new Promise((resolve, reject) => {
          this.fontLoader.load(fontPath, resolve, undefined, reject);
        });

    this.fontCache.set(fontPath, font);
    return font;
  }

  clearCurrentMeshes() {
    [this.currentTextMesh, this.currentGlowMesh, this.currentBackGlowMesh].forEach((mesh) => {
      if (!mesh) {
        return;
      }

      this.meshGroup.remove(mesh);
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    });

    this.currentTextMesh = null;
    this.currentGlowMesh = null;
    this.currentBackGlowMesh = null;
    this.clearMeasurementGuides();
    this.currentBoundingSize = null;
    this.activeLightingMode = 'none';
  }

  clearMeasurementGuides() {
    if (this.measurementGroup) {
      while (this.measurementGroup.children.length) {
        const child = this.measurementGroup.children.pop();
        if (!child) {
          continue;
        }
        this.disposeObject3D(child);
      }
    }

    this.currentDimensionTextures.forEach((texture) => texture.dispose());
    this.currentDimensionTextures = [];
  }

  disposeObject3D(object) {
    if (!object) {
      return;
    }

    object.traverse((node) => {
      if (node.geometry) {
        node.geometry.dispose();
      }

      if (Array.isArray(node.material)) {
        node.material.forEach((material) => {
          if (material?.map) {
            material.map.dispose();
          }
          material?.dispose();
        });
      } else if (node.material) {
        if (node.material.map) {
          node.material.map.dispose();
        }
        node.material.dispose();
      }
    });
  }

  createDimensionLabel(text, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(13, 25, 40, 0.88)';
    context.strokeStyle = 'rgba(173, 216, 255, 0.62)';
    context.lineWidth = 4;

    const radius = 18;
    const width = canvas.width - 10;
    const height = canvas.height - 10;
    const x = 5;
    const y = 5;

    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + width - radius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + radius);
    context.lineTo(x + width, y + height - radius);
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    context.lineTo(x + radius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = colorHex;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 38px Arial';
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    this.currentDimensionTextures.push(texture);

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 2;
    sprite.scale.set(3.1, 1.12, 1);
    return sprite;
  }

  buildDimensionGuide(start, end, labelText) {
    const guide = new THREE.Group();
    const color = 0x8ad6ff;
    const points = [start.clone(), end.clone()];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9
      })
    );
    guide.add(line);

    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.001) {
      return guide;
    }
    direction.normalize();

    const coneLength = THREE.MathUtils.clamp(length * 0.09, 0.12, 0.35);
    const coneRadius = coneLength * 0.42;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneLength, 16);
    const coneMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });

    const headStart = new THREE.Mesh(coneGeometry, coneMaterial.clone());
    headStart.position.copy(start);
    headStart.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().negate());
    guide.add(headStart);

    const headEnd = new THREE.Mesh(coneGeometry, coneMaterial.clone());
    headEnd.position.copy(end);
    headEnd.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    guide.add(headEnd);

    const label = this.createDimensionLabel(labelText, '#ccefff');
    if (label) {
      label.position.copy(start.clone().add(end).multiplyScalar(0.5));
      guide.add(label);
    }

    return guide;
  }

  updateMeasurementGuides(boundingBox) {
    if (!boundingBox || !this.measurementGroup) {
      return;
    }

    this.clearMeasurementGuides();

    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    this.currentBoundingSize = size.clone();

    const widthMm = Math.round(size.x / MM_TO_UNITS);
    const heightMm = Math.round(size.y / MM_TO_UNITS);
    const offset = Math.max(0.22, size.y * 0.13);
    const zGuide = Math.max(size.z * 0.72, 0.2);

    const min = boundingBox.min;
    const max = boundingBox.max;

    const widthY = min.y - offset;
    const widthStart = new THREE.Vector3(min.x, widthY, zGuide);
    const widthEnd = new THREE.Vector3(max.x, widthY, zGuide);
    const widthGuide = this.buildDimensionGuide(widthStart, widthEnd, `${widthMm} мм`);
    this.measurementGroup.add(widthGuide);

    const heightX = min.x - offset;
    const heightStart = new THREE.Vector3(heightX, min.y, zGuide);
    const heightEnd = new THREE.Vector3(heightX, max.y, zGuide);
    const heightGuide = this.buildDimensionGuide(heightStart, heightEnd, `${heightMm} мм`);
    this.measurementGroup.add(heightGuide);

    const helperMaterial = new THREE.LineBasicMaterial({
      color: 0x8ad6ff,
      transparent: true,
      opacity: 0.35
    });

    const extensionPoints = [
      new THREE.Vector3(min.x, min.y, zGuide),
      new THREE.Vector3(min.x, widthY, zGuide),
      new THREE.Vector3(max.x, min.y, zGuide),
      new THREE.Vector3(max.x, widthY, zGuide),
      new THREE.Vector3(min.x, min.y, zGuide),
      new THREE.Vector3(heightX, min.y, zGuide),
      new THREE.Vector3(min.x, max.y, zGuide),
      new THREE.Vector3(heightX, max.y, zGuide)
    ];

    for (let index = 0; index < extensionPoints.length; index += 2) {
      const extGeometry = new THREE.BufferGeometry().setFromPoints([
        extensionPoints[index],
        extensionPoints[index + 1]
      ]);
      this.measurementGroup.add(new THREE.Line(extGeometry, helperMaterial.clone()));
    }
  }

  updateStageLayout(size, boundingBox) {
    if (!size || !boundingBox) {
      return;
    }

    if (this.floorMesh) {
      const stageWidth = THREE.MathUtils.clamp(size.x * 1.25, 10, 80);
      const stageDepth = THREE.MathUtils.clamp(Math.max(size.y * 3.4, size.z * 12), 7.2, 28);
      this.floorMesh.scale.set(stageWidth / 18, stageDepth / 12, 1);
      this.floorMesh.position.y = boundingBox.min.y - Math.max(size.y * 0.44, 0.72);
      this.floorMesh.position.z = -Math.max(size.z * 1.2, 0.9);
    }

    if (this.backdropMesh) {
      const wallWidth = THREE.MathUtils.clamp(size.x * 1.34, 12, 90);
      const wallHeight = THREE.MathUtils.clamp(size.y * 3.2, 9, 30);
      this.backdropMesh.scale.set(wallWidth / 18, wallHeight / 10, 1);
      this.backdropMesh.position.set(0, size.y * 0.5, -Math.max(size.z * 2.5, 4.2));
    }
  }

  async update(options) {
    if (this.destroyed) {
      return;
    }

    const text = normalizeText(options.text);
    const sizeUnits = clampNumber(options.height, 100, 1000, 300) * MM_TO_UNITS;
    const depthUnits = clampNumber(options.depth, 20, 200, 60) * MM_TO_UNITS;
    const bevelThickness = THREE.MathUtils.clamp(depthUnits * 0.08, 0.02, 0.11);
    const bevelSize = THREE.MathUtils.clamp(sizeUnits * 0.028, 0.018, 0.14);

    const font = await this.loadFont(options.font, options.fontWeight);

    const geometry = new TextGeometry(text, {
      font,
      size: sizeUnits,
      depth: depthUnits,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness,
      bevelSize,
      bevelOffset: 0,
      bevelSegments: 3
    });

    geometry.computeBoundingBox();
    geometry.computeVertexNormals();

    this.clearCurrentMeshes();

    const visual = materialStyle(options.material, options.color);
    const textMaterial = new THREE.MeshStandardMaterial({
      color: visual.color,
      metalness: visual.metalness,
      roughness: visual.roughness,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
      side: THREE.DoubleSide
    });

    this.currentTextMesh = new THREE.Mesh(geometry, textMaterial);
    this.meshGroup.add(this.currentTextMesh);

    const glowColor = new THREE.Color(options.color);

    if (options.lighting === 'backlit') {
      const backGeometry = geometry.clone();
      const backMaterial = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      });
      this.currentBackGlowMesh = new THREE.Mesh(backGeometry, backMaterial);
      this.currentBackGlowMesh.scale.set(1.12, 1.12, 1.12);
      this.currentBackGlowMesh.position.z = -depthUnits * 0.45;
      this.meshGroup.add(this.currentBackGlowMesh);
    } else if (options.lighting === 'faceLit') {
      textMaterial.emissive = glowColor.clone();
      textMaterial.emissiveIntensity = 0.55;

      const glowGeometry = geometry.clone();
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this.currentGlowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      this.currentGlowMesh.scale.set(1.055, 1.055, 1.055);
      this.currentGlowMesh.position.z = depthUnits * 0.08;
      this.meshGroup.add(this.currentGlowMesh);
    }

    this.activeLightingMode = options.lighting;
    this.lastUpdateTimestamp = performance.now();
    this.updateMeasurementGuides(geometry.boundingBox);

    this.fitCameraToText();
  }

  fitCameraToText() {
    if (!this.currentTextMesh || !this.currentTextMesh.geometry) {
      return;
    }

    this.currentTextMesh.geometry.computeBoundingBox();
    const boundingBox = this.currentTextMesh.geometry.boundingBox;
    if (!boundingBox) {
      return;
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    boundingBox.getCenter(center);
    boundingBox.getSize(size);

    const signLift = Math.max(size.y * 0.1, 0.22);

    this.meshGroup.position.set(-center.x, -center.y + signLift, -center.z * 0.5);
    this.measurementGroup.position.set(-center.x, -center.y + signLift, -center.z * 0.5);
    this.updateStageLayout(size, boundingBox);

    const maxDimension = Math.max(size.x, size.y, size.z);
    const fov = (this.camera.fov * Math.PI) / 180;
    let distance = (maxDimension / 2) / Math.tan(fov / 2);
    distance *= 1.52;

    this.camera.position.set(distance * 0.52, distance * 0.3, distance * 1.2);
    this.camera.near = Math.max(0.01, distance / 120);
    this.camera.far = distance * 80;
    this.camera.updateProjectionMatrix();

    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  animate() {
    if (this.destroyed) {
      return;
    }

    this.frameId = window.requestAnimationFrame(() => this.animate());

    const elapsedSeconds = performance.now() * 0.001;
    if (this.currentTextMesh?.material && this.activeLightingMode !== 'none') {
      const pulse = 0.82 + Math.sin(elapsedSeconds * 2.9) * 0.18;
      const material = this.currentTextMesh.material;
      if (this.activeLightingMode === 'faceLit') {
        material.emissiveIntensity = 0.45 + pulse * 0.28;
      } else if (this.activeLightingMode === 'backlit') {
        material.emissiveIntensity = 0.12 + pulse * 0.09;
      }
    }

    if (this.currentGlowMesh?.material) {
      this.currentGlowMesh.material.opacity = 0.18 + Math.sin(elapsedSeconds * 3.1) * 0.04;
    }

    if (this.currentBackGlowMesh?.material) {
      this.currentBackGlowMesh.material.opacity = 0.27 + Math.sin(elapsedSeconds * 2.5) * 0.07;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.destroyed = true;

    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.clearCurrentMeshes();
    this.clearMeasurementGuides();

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.fontCache.clear();
  }
}

function buildOrderComment(options, totalPrice) {
  const lightingLabels = {
    none: 'без подсветки',
    backlit: 'контражурная',
    faceLit: 'светящиеся буквы'
  };

  const mountingLabels = {
    undefined: 'не определено',
    standoffs: 'дистанционные держатели',
    base: 'монтажная основа',
    other: 'другое'
  };

  const materialLabels = {
    PLA: 'PLA',
    PETG: 'PETG',
    OTHER: 'другой'
  };

  return `Расчёт вывески: «${normalizeText(options.text)}». Высота: ${options.height} мм. Глубина: ${options.depth} мм. Материал: ${materialLabels[options.material] || options.material}. Подсветка: ${lightingLabels[options.lighting] || options.lighting}. Крепление: ${mountingLabels[options.mounting] || options.mounting}. Количество: ${options.quantity}. Предварительная стоимость: ${formatRubles(totalPrice)}.`;
}

function readOptionsFromForm(elements) {
  return {
    text: normalizeText(elements.text.value),
    height: clampNumber(elements.height.value, 100, 1000, 300),
    depth: clampNumber(elements.depth.value, 20, 200, 60),
    font: elements.fontFamily.value,
    fontWeight: elements.fontWeight.value,
    color: elements.color.value,
    lighting: elements.lighting.value,
    mounting: elements.mounting.value,
    material: elements.material.value,
    quantity: clampNumber(elements.quantity.value, 1, 100, 1)
  };
}

function syncControls(elements, options) {
  elements.text.value = options.text;
  elements.height.value = String(options.height);
  elements.depth.value = String(options.depth);
  elements.quantity.value = String(options.quantity);
  elements.heightValue.textContent = `${options.height} мм`;
  elements.depthValue.textContent = `${options.depth} мм`;
}

function initCalculator() {
  const viewport = document.getElementById('sign3dViewport');
  if (!viewport) {
    return;
  }

  const fallback = document.getElementById('sign3dFallback');
  const priceNode = document.getElementById('calcPrice');
  const orderButton = document.getElementById('calcOrderButton');

  const elements = {
    text: document.getElementById('calcText'),
    height: document.getElementById('calcHeight'),
    heightValue: document.getElementById('calcHeightValue'),
    depth: document.getElementById('calcDepth'),
    depthValue: document.getElementById('calcDepthValue'),
    fontFamily: document.getElementById('calcFontFamily'),
    fontWeight: document.getElementById('calcFontWeight'),
    color: document.getElementById('calcColor'),
    lighting: document.getElementById('calcLighting'),
    mounting: document.getElementById('calcMounting'),
    material: document.getElementById('calcMaterial'),
    quantity: document.getElementById('calcQuantity'),
    swatches: Array.from(document.querySelectorAll('.calc-swatch'))
  };

  let options = readOptionsFromForm(elements);
  syncControls(elements, options);

  const preview = new SignPreview3D(viewport, fallback);

  function setActiveSwatch(hexColor) {
    elements.swatches.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.color === hexColor);
    });
  }

  async function rerenderPreview() {
    try {
      await preview.update(options);
      fallback.hidden = true;
    } catch (error) {
      console.error('3D preview render failed:', error);
      fallback.hidden = false;
    }
  }

  function updatePrice() {
    const totalPrice = calculatePrice(options);
    priceNode.textContent = formatRubles(totalPrice);
    return totalPrice;
  }

  async function applyFormState({ rerender3d = false } = {}) {
    options = readOptionsFromForm(elements);
    syncControls(elements, options);

    if (rerender3d) {
      await rerenderPreview();
    }

    updatePrice();
  }

  elements.text.addEventListener('input', async () => {
    elements.text.value = normalizeText(elements.text.value);
    await applyFormState({ rerender3d: true });
  });

  elements.height.addEventListener('input', async () => {
    await applyFormState({ rerender3d: true });
  });

  elements.depth.addEventListener('input', async () => {
    await applyFormState({ rerender3d: true });
  });

  elements.fontFamily.addEventListener('change', async () => {
    await applyFormState({ rerender3d: true });
  });

  elements.fontWeight.addEventListener('change', async () => {
    await applyFormState({ rerender3d: true });
  });

  elements.color.addEventListener('input', async () => {
    setActiveSwatch(elements.color.value.toLowerCase());
    await applyFormState({ rerender3d: true });
  });

  elements.lighting.addEventListener('change', async () => {
    await applyFormState({ rerender3d: true });
  });

  elements.material.addEventListener('change', async () => {
    await applyFormState({ rerender3d: true });
  });

  elements.mounting.addEventListener('change', async () => {
    await applyFormState({ rerender3d: false });
  });

  elements.quantity.addEventListener('change', async () => {
    await applyFormState({ rerender3d: false });
  });

  elements.quantity.addEventListener('input', async () => {
    await applyFormState({ rerender3d: false });
  });

  elements.swatches.forEach((button) => {
    button.addEventListener('click', async () => {
      const color = button.dataset.color;
      if (!color) {
        return;
      }

      elements.color.value = color;
      setActiveSwatch(color);
      await applyFormState({ rerender3d: true });
    });
  });

  orderButton.addEventListener('click', () => {
    const totalPrice = updatePrice();
    const comment = buildOrderComment(options, totalPrice);

    if (window.OrderFormModal && typeof window.OrderFormModal.open === 'function') {
      window.OrderFormModal.open({
        service: 'custom-sign',
        comment
      });
      return;
    }

    window.location.href = '/custom-sign';
  });

  preview
    .init()
    .then(() => rerenderPreview())
    .catch((error) => {
      console.error('3D preview init failed:', error);
      fallback.hidden = false;
      updatePrice();
    });

  window.addEventListener('beforeunload', () => {
    preview.destroy();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initCalculator();
});
