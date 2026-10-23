/**
 * Browser signals that the letterboxed canvas should be measured again.
 * The renderer ignores a call when the size and DPR have not changed.
 */

export function watchViewport(container: HTMLElement, onChange: () => void): () => void {
  let disposed = false;
  const run = (): void => {
    if (!disposed) onChange();
  };

  const onOrientation = (): void => {
    run();
    // Inside orientationchange the reported size can still be the previous one.
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(run);
    }
  };

  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', onOrientation);

  let disconnectObserver = (): void => {};
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(run);
    observer.observe(container);
    disconnectObserver = () => observer.disconnect();
  }

  let media: MediaQueryList | null = null;
  function bindDpr(): void {
    if (media) media.removeEventListener('change', onDpr);
    media = null;
    if (disposed || typeof window.matchMedia !== 'function') return;
    const dpr = window.devicePixelRatio || 1;
    media = window.matchMedia(`(resolution: ${dpr}dppx)`);
    media.addEventListener('change', onDpr);
  }
  function onDpr(): void {
    run();
    bindDpr();
  }
  bindDpr();

  return () => {
    disposed = true;
    window.removeEventListener('resize', run);
    window.removeEventListener('orientationchange', onOrientation);
    disconnectObserver();
    if (media) media.removeEventListener('change', onDpr);
  };
}
