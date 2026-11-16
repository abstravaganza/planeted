export function TennisArt() {
  return (
    <svg
      className="tennis-art"
      viewBox="0 0 440 340"
      role="img"
      aria-label="A tennis racket and ball on a green court, with colorful Russian word tiles"
    >
      <defs>
        <pattern
          id="strings"
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
        >
          <path d="M9 0H0V9" fill="none" stroke="#b6cd7c" strokeWidth="1.5" />
        </pattern>
        <clipPath id="racket">
          <ellipse cx="270" cy="126" rx="54" ry="73" />
        </clipPath>
      </defs>
      <circle cx="231" cy="169" r="145" fill="#e2e9d7" />
      <path d="M100 255L180 64L359 91L368 269Z" fill="#547b5a" />
      <path
        d="M109 232L177 80L344 104L352 248ZM145 151L348 179M255 91L249 242M151 179L349 204"
        fill="none"
        stroke="#d6e2be"
        strokeWidth="2"
      />
      <g transform="rotate(27 270 170)">
        <path
          d="M248 194L257 239H281L291 194"
          fill="none"
          stroke="#d4e889"
          strokeWidth="7"
        />
        <path
          d="M268 233L268 299"
          stroke="#f1aa5a"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path
          d="M261 251L275 256M261 264L275 269M261 277L275 282"
          stroke="#d9853b"
          strokeWidth="2"
        />
        <ellipse
          cx="270"
          cy="126"
          rx="61"
          ry="80"
          fill="#243e31"
          stroke="#d4e889"
          strokeWidth="8"
        />
        <ellipse cx="270" cy="126" rx="54" ry="73" fill="url(#strings)" />
        <path
          d="M208 122Q219 41 271 47"
          stroke="#f2f5d1"
          strokeWidth="3"
          fill="none"
        />
      </g>
      <circle cx="166" cy="233" r="24" fill="#d8ee72" />
      <path
        d="M147 219Q176 220 178 254M150 250Q149 230 178 214"
        fill="none"
        stroke="#f6f6d5"
        strokeWidth="3"
      />
      <g transform="rotate(-9 100 92)">
        <rect
          x="35"
          y="68"
          width="120"
          height="45"
          rx="12"
          fill="#d7d7f7"
          stroke="#c6c5ed"
        />
        <text
          x="95"
          y="96"
          textAnchor="middle"
          fill="#48427b"
          fontSize="19"
          fontFamily="Arial"
        >
          Я играю
        </text>
      </g>
      <g transform="rotate(7 341 267)">
        <rect
          x="281"
          y="249"
          width="120"
          height="43"
          rx="12"
          fill="#f8dca2"
          stroke="#e8c77f"
        />
        <text
          x="341"
          y="276"
          textAnchor="middle"
          fill="#70531e"
          fontSize="18"
          fontFamily="Arial"
        >
          в теннис
        </text>
      </g>
      <path
        d="M373 74V92M364 83H382M75 211V225M68 218H82"
        stroke="#9eae65"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="344" cy="39" r="4" fill="#cc9171" />
      <circle cx="85" cy="145" r="4" fill="#a8a5d2" />
    </svg>
  );
}
