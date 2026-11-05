import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'tools/pixel-editor/index.html'), 'utf8');

describe('pixel editor guide', () => {
  it('names both paths and the four controls a first-time user asked about', () => {
    expect(page).toContain('使用说明');
    expect(page).toContain('路径 A');
    expect(page).toContain('路径 B');
    expect(page).toContain('载入示例');
    expect(page).toContain('id="part-clear"');
    expect(page).toContain('清空当前素材');
    expect(page).toMatch(/id="export"[^>]*disabled/);
    expect(page).toMatch(/id="asm-move"[^>]*disabled/);
    expect(page).toContain('不是游戏正式资产');
    expect(page).toContain('载入装配示例');
    expect(page).toContain('移入装配');
    expect(page).toContain('网格文件');
    expect(page).toContain('装配文件');
    expect(page).toContain('零件预览');
    expect(page).toContain('装配预览');
    expect(page).toContain('id="part-dialog"');
    expect(page).toContain('id="part-open"');
    expect(page).toContain('id="asm-inspector"');
    expect(page).toContain('选中零件');
    expect(page.indexOf('id="asm-view"')).toBeLessThan(page.indexOf('id="part-dialog"'));
    expect(page.indexOf('id="view"')).toBeGreaterThan(page.indexOf('id="part-dialog"'));
    expect(page.indexOf('id="asm-fields"')).toBeGreaterThan(page.indexOf('id="asm-inspector"'));
    expect(page).toContain('id="view"');
    expect(page).toContain('id="asm-view"');
    expect(page).toContain('边界宽');
    expect(page).toContain('previewFrame');
    expect(page).toContain('360');
    expect(page).toContain('缩放');
    expect(page).toContain('上移');
    expect(page).toContain('folded');
    expect(page).toContain('half');
    expect(page).toContain('open');
    expect(page).toContain('*.grid.json');
    expect(page).toContain('*.entity.json');
    expect(page).toContain('现役');
    expect(page).toContain('id="guide"');
    expect(page).toContain('id="guide-open"');
  });

  it('puts the bank comparison under the assembly and says only the right bank is edited', () => {
    const panel = page.indexOf('id="bank-panel"');
    expect(panel).toBeGreaterThan(page.indexOf('id="asm-view"'));
    expect(panel).toBeLessThan(page.indexOf('id="asm-parts"'));
    expect(page).toContain('侧倾对比');
    expect(page).toContain('只编右倾');
    expect(page).toContain('文件里没有左倾阶段');
    for (const id of ['bank-view', 'bank-angle', 'bank-sx', 'bank-sy', 'bank-taper', 'bank-mode']) {
      expect(page).toContain(`id="${id}"`);
    }
    expect(page).toContain('改成手调');
    expect(page).toContain('横向拉伸');
  });

  it('explains the selection handles and where arrow keys go', () => {
    expect(page).toContain('拖白色角点');
    expect(page).toContain('拖顶上圆点旋转');
    expect(page).toContain('焦点在「侧倾对比」上时，← → 切换格子，不挪零件');
    expect(page).toMatch(/id="asm-view"[^>]*tabindex="0"/);
    expect(page).toMatch(/id="bank-view"[^>]*tabindex="0"/);
  });

  it('names skew and says the frame does not follow part edits', () => {
    expect(page).toContain('id="asm-kx"');
    expect(page).toContain('id="asm-ky"');
    expect(page).toContain('id="asm-handle-mode"');
    expect(page).toContain('斜切 X');
    expect(page).toContain('skewX');
    expect(page).toContain('游戏里的贴图暂时还不读');
    expect(page).toContain('拉伸、斜切、旋转、移动零件都不会改它的大小和位置');
  });

  it('describes the P3 playback panel and its controls', () => {
    expect(page).toContain('播放预览');
    for (const id of [
      'play-panel',
      'play-mode',
      'play-from',
      'play-to',
      'play-move',
      'play-hold',
      'play-ease',
      'play-speed',
      'play-loop',
      'play-snap',
      'play-toggle',
      'play-stop',
      'play-scrub',
      'play-frame',
    ]) {
      expect(page).toContain(`id="${id}"`);
    }
    expect(page).toContain('侧倾循环');
    expect(page).toContain('阶段 A → B');
    expect(page).not.toContain('播放阶段');
  });

  it('describes P2 presets, batch pixelize, and the compare view', () => {
    expect(page).toContain('参数预设');
    expect(page).toContain('批量量化');
    expect(page).toContain('对照并排');
    expect(page).toContain('只标不同');
    expect(page).toContain('Eagle 28×32');
    expect(page).toContain('Boss 零件');
    for (const id of [
      'preset',
      'preset-apply',
      'preset-save',
      'preset-delete',
      'preset-name',
      'compare-on',
      'compare-overlay',
      'compare-ref',
      'compare-pix',
      'compare-kind',
      'compare-preset',
      'compare-grid',
      'compare-diff',
      'batch-open',
      'batch-dialog',
      'batch-preset',
      'batch-files',
      'batch-dir',
      'batch-run',
      'batch-zip',
      'batch-list',
    ]) {
      expect(page).toContain(`id="${id}"`);
    }
  });
});
