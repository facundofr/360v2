export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        color: "#b0b8c8",
        textAlign: "center",
        padding: "10px 20px",
        fontSize: "0.80rem",
        letterSpacing: "0.03em",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.3)",
      }}
    >
      <span>
        &copy; {year}{" "}
        <strong style={{ color: "#ffffff" }}>Grupo Cober</strong>
        {" · "}
        Desarrollado por{" "}
        <strong style={{ color: "#ffffff" }}>Performance marketing</strong>
      </span>
    </footer>
  )
}
