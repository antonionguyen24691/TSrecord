type AdSlotProps = {
  format?: 'horizontal' | 'rectangle';
};

export const AdSlot = ({ format = 'horizontal' }: AdSlotProps) => (
  <aside
    className={`site-ad-slot site-ad-slot--${format}`}
    aria-label="Vị trí quảng cáo"
    data-ad-slot
  >
    <span>Quảng cáo</span>
    <p>Vị trí dành cho đơn vị quảng cáo sau khi website được phê duyệt.</p>
  </aside>
);
