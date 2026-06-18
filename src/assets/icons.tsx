import type { SVGProps } from 'react';

export function TheatreModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" role="presentation" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5Zm14 0h4v14h-4V5Zm-2 0H4v14h10V5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
