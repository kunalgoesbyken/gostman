const DEFAULT_SIZE = 16

export function SvgIcon({ icon, className }) {
  const viewBox = `0 0 ${icon.width ?? DEFAULT_SIZE} ${icon.height ?? DEFAULT_SIZE}`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox={viewBox}
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  )
}
