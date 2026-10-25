import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomableImage } from './ZoomableImage';

describe('ZoomableImage 全屏放大与缩放组件', () => {
  it('默认以内嵌模式渲染，并提供全屏放大入口', () => {
    render(<ZoomableImage src="blob:http://localhost/test-image.jpg" alt="测试错题" />);

    const img = screen.getByAltText('测试错题');
    expect(img).toBeInTheDocument();

    const fullscreenBtn = screen.getByRole('button', { name: /全屏放大/i });
    expect(fullscreenBtn).toBeInTheDocument();
  });

  it('点击全屏放大按钮进入沉浸式全屏 Portal，显示退出全屏与控制项', () => {
    const handleFullscreenChange = vi.fn();
    render(
      <ZoomableImage
        src="blob:http://localhost/test-image.jpg"
        alt="测试错题"
        onFullscreenChange={handleFullscreenChange}
        title="数学真题解析"
      />
    );

    const fullscreenBtn = screen.getByRole('button', { name: /全屏放大/i });
    fireEvent.click(fullscreenBtn);

    expect(handleFullscreenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('数学真题解析')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();

    const exitBtn = screen.getByRole('button', { name: /退出全屏/i });
    expect(exitBtn).toBeInTheDocument();

    // 点击退出全屏
    fireEvent.click(exitBtn);
    expect(handleFullscreenChange).toHaveBeenCalledWith(false);
  });

  it('支持 initialFullscreen 模式，按下 Escape 触发 onClose', () => {
    const handleClose = vi.fn();
    render(
      <ZoomableImage
        src="blob:http://localhost/test-image.jpg"
        alt="全屏错题"
        initialFullscreen={true}
        onClose={handleClose}
      />
    );

    expect(screen.getByRole('button', { name: /退出全屏/i })).toBeInTheDocument();

    // 触发 Esc 按键
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('点击放大与缩小按钮更新缩放比例', () => {
    render(<ZoomableImage src="blob:http://localhost/test-image.jpg" alt="测试错题" />);

    const zoomInBtn = screen.getByRole('button', { name: '放大' });
    const zoomOutBtn = screen.getByRole('button', { name: '缩小' });

    // 初始状态 scale=1，缩小按钮 disabled
    expect(zoomOutBtn).toBeDisabled();

    // 点击放大
    fireEvent.click(zoomInBtn);
    expect(zoomOutBtn).not.toBeDisabled();
    expect(screen.getByText('135%')).toBeInTheDocument();

    // 点击复位
    const resetBtn = screen.getByRole('button', { name: /复位/i });
    fireEvent.click(resetBtn);
    expect(zoomOutBtn).toBeDisabled();
  });
});
