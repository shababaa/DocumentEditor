import { Link } from "react-router-dom";
import Icon from "./Icon.jsx";

export default function Brand({ compact = false, to = "/" }) {
  return (
    <Link className={`brand ${compact ? "brand--compact" : ""}`} to={to} aria-label="DocuEdit home">
      <span className="brand__mark"><Icon name="document" size={17} /></span>
      {!compact && <span className="brand__name">DocuEdit</span>}
    </Link>
  );
}
