/**
 * PONTI ARENA - Character Asset Manager
 * Fallback priority: local photo (assets/characters/<id>.png) -> generated
 * SVG icon (role + weapon themed) -> emoji fallback. Battle engine and UI
 * never need to know which tier resolved; they just call getCharacterAsset().
 * No character card, battle slot, timeline entry, or result screen can ever
 * render a broken image.
 */

const AssetManager = {
  _cache: new Map(),      // characterId -> resolved asset descriptor
  _checked: new Set(),    // characterId -> whether photo probe finished

  /** Returns an <img> or generated element wrapped in a container, synchronously safe to insert. */
  buildAvatarElement(character, sizeClass = '') {
    const wrap = document.createElement('div');
    wrap.className = `char-avatar ${sizeClass}`;
    wrap.style.setProperty('--char-color', character.color || '#c9a227');
  
    // Format ID agar selalu menggunakan strip (-)
    const safeId = String(character.id || '')
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
  
    const img = document.createElement('img');
    img.alt = character.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = `assets/characters/${safeId}.png`;
    
    img.onload = () => { wrap.classList.add('photo-loaded'); };
    img.onerror = () => {
      img.remove();
      wrap.appendChild(this.buildGeneratedIcon(character));
      wrap.classList.add('fallback-loaded');
    };
    wrap.appendChild(img);
    return wrap;
  },

  /** Generated SVG/emoji icon - always succeeds, never throws. */
  buildGeneratedIcon(character) {
    try {
      const holder = document.createElement('div');
      holder.className = 'generated-icon';
      holder.style.background = `radial-gradient(circle at 35% 30%, ${this._lighten(character.color)}, ${character.color || '#333'} 70%)`;
      const emoji = document.createElement('span');
      emoji.className = 'generated-icon-emoji';
      emoji.textContent = character.icon || '❔';
      holder.appendChild(emoji);
      return holder;
    } catch (err) {
      const span = document.createElement('span');
      span.textContent = character.icon || '❔';
      return span;
    }
  },

  _lighten(hex) {
    if (!hex) return '#666';
    try {
      const c = hex.replace('#', '');
      const num = parseInt(c, 16);
      const r = Math.min(255, ((num >> 16) & 0xff) + 60);
      const g = Math.min(255, ((num >> 8) & 0xff) + 60);
      const b = Math.min(255, (num & 0xff) + 60);
      return `rgb(${r},${g},${b})`;
    } catch (e) { return hex; }
  },
};
