const shelf = document.querySelector('#album-shelf');
const contactSheet = document.querySelector('#contact-sheet');
const contactTitle = document.querySelector('#contact-title');
const contactCount = document.querySelector('#contact-count');
const contactDescription = document.querySelector('#contact-description');
const photoGrid = document.querySelector('#photo-grid');
const reader = document.querySelector('#reader');
const closeReaderButton = document.querySelector('#close-reader');
const readerTitle = document.querySelector('#reader-title');
const imageFrame = document.querySelector('#image-frame');
const fullscreenButton = document.querySelector('#fullscreen-button');
const readerImages = [document.querySelector('#reader-image-a'), document.querySelector('#reader-image-b')];
const photoCaption = document.querySelector('#photo-caption');
const photoDetails = document.querySelector('#photo-details');
const albumDescription = document.querySelector('#album-description');
const currentPage = document.querySelector('#current-page');
const totalPages = document.querySelector('#total-pages');
const previousPageButton = document.querySelector('#previous-page');
const nextPageButton = document.querySelector('#next-page');
const fullscreenPreviousButton = document.querySelector('#fullscreen-previous-page');
const fullscreenNextButton = document.querySelector('#fullscreen-next-page');
const toast = document.querySelector('#toast');

let albums = [];
let activeAlbum = null;
let pageIndex = 0;
let toastTimer;
let activeImageIndex = 0;
let pageRequestId = 0;
let pageIsLoading = false;
const rawAssetBase = 'https://raw.githubusercontent.com/zstar1003/PhotoNest/main/';

function isLocalPreview() {
  return ['localhost', '127.0.0.1', ''].includes(window.location.hostname) || window.location.protocol === 'file:';
}

function resolveOriginalAsset(path) {
  if (!path || /^(https?:)?\/\//.test(path) || path.startsWith('data:') || isLocalPreview()) return path;
  return rawAssetBase + path.split('/').map(encodeURIComponent).join('/');
}

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

function thumbnailCard(photo, index) {
  const card = document.createElement('button');
  card.className = 'thumbnail-card';
  card.type = 'button';
  card.setAttribute('aria-label', `查看原图：${photo.title}，第 ${pad(index + 1)} 张`);
  card.innerHTML = `
    <img src="${photo.thumb}" alt="${photo.alt}" loading="eager" decoding="async" />
    <span class="thumbnail-meta"><span>${pad(index + 1)}</span><strong>${photo.title}</strong></span>`;
  card.addEventListener('click', () => openPhoto(index));
  return card;
}

function renderContactSheet() {
  contactTitle.textContent = activeAlbum.title;
  contactCount.textContent = `${pad(activeAlbum.photos.length)} photographs`;
  contactDescription.textContent = activeAlbum.description;
  photoGrid.replaceChildren(...activeAlbum.photos.map(thumbnailCard));
  anime({
    targets: '.thumbnail-card', opacity: [0, 1], translateY: [14, 0],
    duration: 500, delay: anime.stagger(38, { start: 80 }), easing: 'easeOutCubic',
  });
}

function openAlbum(album) {
  activeAlbum = album;
  renderContactSheet();
  contactSheet.classList.add('is-open');
  contactSheet.setAttribute('aria-hidden', 'false');
  anime.remove(contactSheet);
  anime({ targets: contactSheet, opacity: [0, 1], duration: 360, easing: 'easeOutQuad' });
}

function closeContactSheet() {
  anime.remove(contactSheet);
  anime({
    targets: contactSheet, opacity: [1, 0], duration: 240, easing: 'easeInQuad',
    complete: () => {
      contactSheet.classList.remove('is-open');
      contactSheet.setAttribute('aria-hidden', 'true');
      contactSheet.style.opacity = '';
      activeAlbum = null;
    },
  });
}

function updatePageMetadata(photo) {
  photoCaption.textContent = photo.title;
  photoDetails.textContent = [photo.location, photo.dimensions].filter(Boolean).join(' · ');
  readerTitle.textContent = activeAlbum.title;
  albumDescription.textContent = activeAlbum.description;
  currentPage.textContent = pad(pageIndex + 1);
  totalPages.textContent = pad(activeAlbum.photos.length);
}

function preloadAdjacentPages() {
  [pageIndex - 1, pageIndex + 1]
    .filter((index) => activeAlbum.photos[index])
    .forEach((index) => { const image = new Image(); image.src = resolveOriginalAsset(activeAlbum.photos[index].src); });
}

function setPageControls(isLoading = false) {
  const atFirstPage = pageIndex === 0;
  const atLastPage = pageIndex === activeAlbum.photos.length - 1;
  [previousPageButton, fullscreenPreviousButton].forEach((button) => { button.disabled = isLoading || atFirstPage; });
  [nextPageButton, fullscreenNextButton].forEach((button) => { button.disabled = isLoading || atLastPage; });
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
  setPageControls(true);
  incoming.alt = photo.alt;

  const finishPageTransition = () => {
    imageFrame.setAttribute('aria-busy', 'false');
    pageIsLoading = false;
    setPageControls();
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
      return;
    }
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
  };

  incoming.onload = revealImage;
  incoming.onerror = () => {
    if (requestId !== pageRequestId) return;
    pageIsLoading = false;
    imageFrame.setAttribute('aria-busy', 'false');
    setPageControls();
    showToast('这张照片暂时无法加载。');
  };
  incoming.src = resolveOriginalAsset(photo.src);
  if (incoming.complete && incoming.naturalWidth) revealImage();
}

function openPhoto(index) {
  if (!activeAlbum || !activeAlbum.photos[index]) return;
  pageIndex = index;
  resetImageLayers();
  closeReaderButton.textContent = '← 返回上级';
  closeReaderButton.setAttribute('aria-label', '返回上级');
  photoCaption.textContent = '';
  photoDetails.textContent = '';
  reader.classList.add('is-open');
  reader.setAttribute('aria-hidden', 'false');
  renderPage(1, true);
  anime.remove(reader);
  anime({ targets: reader, opacity: [0, 1], duration: 360, easing: 'easeOutQuad' });
}

function closeReader() {
  if (getFullscreenElement() === imageFrame) exitFullscreen();
  anime.remove(reader);
  anime({
    targets: reader, opacity: [1, 0], duration: 240, easing: 'easeInQuad',
    complete: () => { reader.classList.remove('is-open'); reader.setAttribute('aria-hidden', 'true'); reader.style.opacity = ''; },
  });
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement;
}

function exitFullscreen() {
  return (document.exitFullscreen || document.webkitExitFullscreen).call(document);
}

async function toggleFullscreen() {
  try {
    if (getFullscreenElement()) {
      await exitFullscreen();
    } else if (imageFrame.requestFullscreen || imageFrame.webkitRequestFullscreen) {
      await (imageFrame.requestFullscreen || imageFrame.webkitRequestFullscreen).call(imageFrame);
    } else {
      showToast('当前浏览器不支持全屏显示。');
    }
  } catch {
    showToast('无法进入全屏显示。');
  }
}

function updateFullscreenButton() {
  const isFullscreen = getFullscreenElement() === imageFrame;
  fullscreenButton.classList.toggle('is-active', isFullscreen);
  fullscreenButton.setAttribute('aria-label', isFullscreen ? '退出全屏显示' : '全屏查看照片');
  fullscreenButton.title = isFullscreen ? '退出全屏显示' : '全屏查看照片';
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
  const downloadUrl = resolveOriginalAsset(photo.download || photo.src);
  const button = document.querySelector('#download-button');
  button.disabled = true;
  button.textContent = '正在准备…';
  try {
    const response = await fetch(downloadUrl, { mode: 'cors' });
    if (!response.ok) throw new Error('Download unavailable');
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(await response.blob()), download: photo.filename || `${photo.title}.jpg` });
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    showToast(`正在下载「${photo.title}」原图`);
  } catch {
    window.open(downloadUrl, '_blank', 'noopener');
    showToast('已在新标签页打开原图，可使用浏览器保存。');
  } finally {
    button.disabled = false;
    button.innerHTML = '下载原图 <span>↓</span>';
  }
}

document.querySelector('#close-contact-sheet').addEventListener('click', closeContactSheet);
document.querySelector('#close-reader').addEventListener('click', closeReader);
previousPageButton.addEventListener('click', () => changePage(-1));
nextPageButton.addEventListener('click', () => changePage(1));
fullscreenPreviousButton.addEventListener('click', () => changePage(-1));
fullscreenNextButton.addEventListener('click', () => changePage(1));
document.querySelector('#download-button').addEventListener('click', downloadCurrentPhoto);
fullscreenButton.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
document.addEventListener('keydown', (event) => {
  if (reader.classList.contains('is-open')) {
    if (event.key === 'ArrowRight') changePage(1);
    if (event.key === 'ArrowLeft') changePage(-1);
    if (event.key === 'Escape') {
      if (getFullscreenElement()) exitFullscreen();
      else closeReader();
    }
    return;
  }
  if (contactSheet.classList.contains('is-open') && event.key === 'Escape') closeContactSheet();
});

fetch('./gallery.json?v=20260702-9')
  .then((response) => { if (!response.ok) throw new Error('Could not load albums'); return response.json(); })
  .then((data) => { albums = data; renderShelf(); })
  .catch(() => showToast('相册暂时无法加载。请检查 gallery.json。'));
