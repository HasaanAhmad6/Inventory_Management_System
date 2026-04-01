import Sidebar from "./Sidebar";
import useBreakpoint from "../hooks/useBreakpoint";

export default function Layout({ children }) {
  const { isMobile, isTablet } = useBreakpoint();

  const marginLeft = isMobile ? 0 : isTablet ? 68 : 240;
  const paddingTop = isMobile ? 56 : 0;
  const paddingBottom = isMobile ? 64 : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f23" }}>
      <Sidebar />
      <main style={{
        marginLeft,
        paddingTop,
        paddingBottom,
        minHeight: "100vh",
        transition: "margin-left 0.3s",
      }}>
        {children}
      </main>
    </div>
  );
}