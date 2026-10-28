/** route transition — คงโครง flex ของ <main> (flex-1/overflow) ไว้ + fade+เลื่อนขึ้นตอนเปลี่ยนหน้า */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="cz-page flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
