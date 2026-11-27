export function VanIllustration({ animated = false }: { animated?: boolean }) {
  return (
    <div className={`welcome-hero${animated ? " van-scene-animated" : ""}`}>
      <svg
        viewBox="0 0 320 144"
        role="img"
        aria-label="A van on a road trip through the Philippines"
      >
        <circle
          className="van-scene-sun"
          cx="251"
          cy="34"
          r="16"
          fill="#ffb12a"
          opacity=".85"
        />
        <path
          d="m0 104 65-65 42 43 41-53 77 75 40-41 55 41v40H0z"
          fill="#8cc6bb"
          opacity=".16"
        />
        <path
          d="m0 111 51-39 70 41 68-32 71 31 60-24v56H0z"
          fill="#8cc6bb"
          opacity=".17"
        />
        <path
          d="M-20 137c74-44 165 4 217-16s89-9 148 1"
          fill="none"
          stroke="#083e41"
          strokeWidth="27"
        />
        <path
          d="M-20 137c74-44 165 4 217-16s89-9 148 1"
          fill="none"
          stroke="#99c6be"
          strokeWidth="1.5"
          strokeDasharray="12 13"
          className="van-scene-road"
          opacity=".6"
        />
        <g className="van-scene-vehicle">
          <g transform="translate(96 47)">
            <path
              d="M5 5h89c7 0 12 3 16 9l18 25v31H0V14C0 9 2 5 5 5z"
              fill="#e9f5ee"
            />
            <path d="M0 49h128v12H0z" fill="#ffad19" />
            <path
              d="M10 15h26v24H10zm34 0h26v24H44zm34 0h16c4 0 7 2 9 5l13 19H78z"
              fill="#185d60"
            />
            <path d="M74 12v49M7 43h63" stroke="#b6d5cf" strokeWidth="2" />
            <path
              d="M79 44h7"
              stroke="#185d60"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M120 47h8v7h-8z" fill="#fff4c9" />
            <rect x="-4" y="62" width="135" height="7" rx="3" fill="#b6d5cf" />
            <circle cx="24" cy="68" r="12" fill="#123e43" />
            <circle cx="24" cy="68" r="5" fill="#b6d5cf" />
            <circle cx="104" cy="68" r="12" fill="#123e43" />
            <circle cx="104" cy="68" r="5" fill="#b6d5cf" />
          </g>
        </g>
      </svg>
    </div>
  );
}
