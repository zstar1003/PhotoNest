const shelf = document.querySelector('#album-shelf');
const reader = document.querySelector('#reader');
const readerTitle = document.querySelector('#reader-title');
const imageFrame = document.querySelector('#image-frame');
const readerImages = [document.querySelector('#reader-image-a'), document.querySelector('#reader-image-b')];
const photoCaption = document.querySelector('#photo-caption');
const photoDetails = document.querySelector('#photo-details');
const albumDescription = document.querySelector('#album-description');
const currentPage = document.querySelector('#current-page');
const totalPages = document.querySelector('#total-pages');
const toast = document.querySelector('#toast');
let albums = [];
let activeAlbum = null;
let pageIndex = 0;
let toastTimer;
let activeImageIndex = 0;
let pageRequestId = 0;
let pageIsLoading = false;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function albumCard(album, index) {
  const card = document.createElement('button');
  card.className = 'album-card';
  card.type = 'button';
  card.style.setProperty('--cover-tint', album.tint);
  card.setAttribute('aria-label', `打开相册：${album.title}`);
  card.innerHTML = `
    <div class="album-cover">
      <img src="${album.cover}" alt="${album.coverAlt}" loading="eager" decoding="async" />
      <div class="cover-content">
        <span class="album-index">Edition ${pad(index + 1)}</span>
        <strong class="cover-title">${album.title}</strong>
        <span class="cover-bottom"><span class="album-count">${pad(album.photos.length)} photographs</span><span class="open-mark">↗</span></span>
      </div>
    </div>`;
  card.addEventListener('click', () => openAlbum(album));
  return card;
}

function renderShelf() {
  shelf.replaceChildren(...albums.map(albumCard));
  anime({
    targets: '.album-card', opacity: [0, 1], translateY: [36, 0], rotate: [-1.5, 0],
    duration: 850, delay: anime.stagger(110, { start: 180 }), easing: 'easeOutExpo',
  });
}

function updatePageMetadata(photo) {
  photoCaption.textContent = photo.title;
  photoDetails.textContent = [photo.location, photo.year, photo.dimensions].filter(Boolean).join(' · ');
  readerTitle.textContent = activeAlbum.title;
  albumDescription.textContent = activeAlbum.description;
  currentPage.textContent = pad(pageIndex + 1);
  totalPages.textContent = pad(activeAlbum.photos.length);
}

function preloadAdjacentPages() {
  [pageIndex - 1, pageIndex + 1]
    .filter((index) => activeAlbum.photos[index])
    .forEach((index) => { const image = new Image(); image.src = activeAlbum.photos[index].src; });
}

function resetImageLayers() {
  readerImages.forEach((image) => {
    anime.remove(image);
    image.style.opacity = '0';
    image.style.transform = 'translateX(0)';
  });
  activeImageIndex = 0;
}

function renderPage(direction = 1, immediate = false) {
  const photo = activeAlbum.photos[pageIndex];
  const requestId = ++pageRequestId;
  const outgoing = readerImages[activeImageIndex];
  const incomingIndex = 1 - activeImageIndex;
  const incoming = readerImages[incomingIndex];
  const pageNodes = [document.querySelector('#photo-page'), document.querySelector('.reader-footer')];
  pageIsLoading = true;
  imageFrame.setAttribute('aria-busy', 'true');
  document.querySelector('#previous-page').disabled = true;
  document.querySelector('#next-page').disabled = true;
  incoming.alt = photo.alt;

  const finishPageTransition = () => {
    imageFrame.setAttribute('aria-busy', 'false');
    pageIsLoading = false;
    document.querySelector('#previous-page').disabled = pageIndex === 0;
    document.querySelector('#next-page').disabled = pageIndex === activeAlbum.photos.length - 1;
    preloadAdjacentPages();
  };

  const revealImage = () => {
    if (requestId !== pageRequestId) return;
    incoming.onload = null;
    incoming.onerror = null;
    anime.remove([outgoing, incoming, ...pageNodes]);
    updatePageMetadata(photo);
    incoming.style.zIndex = '2';
    outgoing.style.zIndex = '1';
    if (immediate) {
      outgoing.style.opacity = '0';
      incoming.style.opacity = '1';
      incoming.style.transform = 'translateX(0)';
      activeImageIndex = incomingIndex;
      finishPageTransition();
    } else {
      anime({ targets: outgoing, opacity: [1, 0], translateX: [0, direction * -20], duration: 320, easing: 'easeOutCubic' });
      anime({
        targets: incoming, opacity: [0, 1], translateX: [direction * 20, 0], duration: 420, easing: 'easeOutCubic',
        complete: () => {
          outgoing.style.opacity = '0';
          outgoing.style.transform = 'translateX(0)';
          activeImageIndex = incomingIndex;
          finishPageTransition();
        },
      });
      anime({ targets: pageNodes, opacity: [0, 1], translateX: [direction * 14, 0], duration: 350, easing: 'easeOutCubic' });
    }
  };

  incoming.onload = revealImage;
  incoming.onerror = () => {
    if (requestId !== pageRequestId) return;
    pageIsLoading = false;
    imageFrame.setAttribute('aria-busy', 'false');
    showToast('这张照片暂时无法加载。');
  };
  incoming.src = photo.src;
  if (incoming.complete && incoming.naturalWidth) revealImage();
}

function openAlbum(album) {
  activeAlbum = album;
  pageIndex = 0;
  resetImageLayers();
  photoCaption.textContent = '';
  photoDetails.textContent = '';
  reader.classList.add('is-open');
  reader.setAttribute('aria-hidden', 'false');
  renderPage(1, true);
  anime({ targets: reader, opacity: [0, 1], duration: 420, easing: 'easeOutQuad' });
}

function closeAlbum() {
  anime.remove(reader);
  anime({
    targets: reader, opacity: [1, 0], duration: 280, easing: 'easeInQuad',
    complete: () => { reader.classList.remove('is-open'); reader.setAttribute('aria-hidden', 'true'); reader.style.opacity = ''; },
  });
}

function changePage(step) {
  if (!activeAlbum || pageIsLoading) return;
  const nextIndex = pageIndex + step;
  if (nextIndex < 0 || nextIndex >= activeAlbum.photos.length) return;
  pageIndex = nextIndex;
  renderPage(step);
}

async function downloadCurrentPhoto() {
  if (!activeAlbum) return;
  const photo = activeAlbum.photos[pageIndex];
  const button = document.querySelector('#download-button');
  button.disabled = true;
  button.textContent = '正在准备…';
  try {
    const response = await fetch(photo.download || photo.src, { mode: 'cors' });
    if (!response.ok) throw new Error('Download unavailable');
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await response.blob()), download: photo.filename || `${photo.title}.jpg` });
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    showToast(`正在下载「${photo.title}」原图`);
  } catch {
    window.open(photo.download || photo.src, '_blank', 'noopener');
    showToast('已在新标签页打开原图，可使用浏览器保存。');
  } finally {
    button.disabled = false;
    button.innerHTML = '下载原图 <span>↓</span>';
  }
}

document.querySelector('#close-reader').addEventListener('click', closeAlbum);
document.querySelector('#previous-page').addEventListener('click', () => changePage(-1));
document.querySelector('#next-page').addEventListener('click', () => changePage(1));
document.querySelector('#download-button').addEventListener('click', downloadCurrentPhoto);
document.addEventListener('keydown', (event) => {
  if (!activeAlbum || !reader.classList.contains('is-open')) return;
  if (event.key === 'ArrowRight') changePage(1);
  if (event.key === 'ArrowLeft') changePage(-1);
  if (event.key === 'Escape') closeAlbum();
});

fetch('./gallery.json?v=20260626-5')
  .then((response) => { if (!response.ok) throw new Error('Could not load albums'); return response.json(); })
  .then((data) => { albums = data; renderShelf(); })
  .catch(() => showToast('相册暂时无法加载。请检查 gallery.json。'));
