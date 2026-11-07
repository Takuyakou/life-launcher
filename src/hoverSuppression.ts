import { useEffect } from "react";

/**
 * P97-02 F: 窓の大きさが変わった直後（最大化・元に戻す・大きさの変更）は、WebView が
 * 前の大きさでのマウスの位置を覚えていて、乗せていないボタンに「乗せた色」が出る。
 * 次にマウスが動く（または押す）まで、乗せた色を出さない。
 */
export function useHoverSuppressionAfterResize(): void {
  useEffect(() => {
    let suppressed = false;
    const suppress = () => {
      if (suppressed) return;
      suppressed = true;
      document.body.classList.add("hover-suppressed");
    };
    const release = () => {
      if (!suppressed) return;
      suppressed = false;
      document.body.classList.remove("hover-suppressed");
    };
    window.addEventListener("resize", suppress);
    window.addEventListener("pointermove", release);
    window.addEventListener("pointerdown", release);
    return () => {
      window.removeEventListener("resize", suppress);
      window.removeEventListener("pointermove", release);
      window.removeEventListener("pointerdown", release);
      document.body.classList.remove("hover-suppressed");
    };
  }, []);
}
