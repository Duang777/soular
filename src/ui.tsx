import { asset } from "./cast";

export function CastFace(props: { name: string; role: string; portrait: string; cta?: string }) {
  return (
    <>
      <span className="portrait">
        <img src={asset(`personas/${props.portrait}.jpg`)} alt={props.name} width={512} height={512} />
      </span>
      <span className="identity">
        <span className="name">{props.name}</span>
        <span className="role">{props.role}</span>
        {props.cta ? <span className="follow">{props.cta}</span> : null}
      </span>
    </>
  );
}
