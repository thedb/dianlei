/**
 * First-run guide. The copy lives in index.html so the page can be read
 * without this script. Closing it once is remembered in localStorage.
 */

const GUIDE_KEY = 'dianlei.pixel-editor.guide.v1';

export function mountGuide(): void {
  const dialog = must(HTMLDialogElement, 'guide');
  must(HTMLButtonElement, 'guide-open').addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });
  must(HTMLButtonElement, 'guide-close').addEventListener('click', () => {
    dialog.close();
  });
  must(HTMLButtonElement, 'guide-try-a').addEventListener('click', () => {
    dialog.close();
    const part = must(HTMLDialogElement, 'part-dialog');
    if (!part.open) part.showModal();
    must(HTMLButtonElement, 'fixture').click();
  });
  must(HTMLButtonElement, 'guide-try-b').addEventListener('click', () => {
    dialog.close();
    must(HTMLButtonElement, 'asm-example').click();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    try {
      localStorage.setItem(GUIDE_KEY, '1');
    } catch {
      // Private mode still closes the dialog for this page view.
    }
  });
  if (!seen() && !dialog.open) dialog.showModal();
}

function seen(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function must<T extends HTMLElement>(ctor: new () => T, id: string): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) throw new Error(`missing #${id}`);
  return el;
}
