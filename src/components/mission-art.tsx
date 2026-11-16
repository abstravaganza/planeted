import { TennisArt } from "./tennis-art";
import type { MissionId } from "@/lib/missions";
export function MissionArt({ id }: { id: MissionId }) {
  if (id === "sports") return <TennisArt />;
  return (
    <svg
      viewBox="0 0 440 340"
      role="img"
      aria-label={
        {
          friends: "Two friends sharing music in a park",
          town: "Colorful town houses and a riverside bridge",
          school: "An open notebook, pencil and school bag",
          weekend: "A museum ticket, camera and weekend calendar",
          guest: "A suitcase, welcome note and travel map",
        }[id]
      }
    >
      <circle cx="222" cy="169" r="140" fill="currentColor" opacity=".12" />
      {id === "friends" && (
        <>
          <path d="M70 260Q220 190 375 260" fill="#b5cfa2" />
          <path d="M121 266V216Q121 175 161 175T202 216V266" fill="#f4a78d" />
          <path d="M223 266V207Q223 171 262 171T303 212V266" fill="#8b8cd0" />
          <circle cx="161" cy="136" r="34" fill="#f6cfaa" />
          <path
            d="M127 136Q119 83 162 91T195 140L178 120L150 116Z"
            fill="#493d4c"
          />
          <circle cx="262" cy="133" r="34" fill="#bd835f" />
          <path
            d="M227 128Q220 85 259 89T295 129L269 113L238 115Z"
            fill="#403a40"
          />
          <path
            d="M173 216Q210 180 245 215M152 134h2m110-1h2"
            fill="none"
            stroke="#453c4d"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect x="192" y="186" width="32" height="49" rx="7" fill="#435c67" />
          <path
            d="M208 184Q185 129 163 155M210 184Q236 132 260 153"
            fill="none"
            stroke="#f6f1d9"
            strokeWidth="4"
          />
          <text x="80" y="75" fill="#825b81" fontSize="36">
            ♪
          </text>
          <text x="328" y="163" fill="#825b81" fontSize="30">
            ♫
          </text>
        </>
      )}
      {id === "town" && (
        <>
          <path d="M66 268Q220 230 380 271V299H66Z" fill="#8ccbd5" />
          <path d="M75 224H368" stroke="#e8c7a7" strokeWidth="20" />
          <path d="M102 217V123L150 88L199 123V217" fill="#eead83" />
          <path d="M212 216V86H272V217" fill="#f2d57c" />
          <path d="M288 217V143L325 114L362 143V217" fill="#afa1cf" />
          <path
            d="M94 126L150 80L205 126M206 86H277M280 146L326 105L370 146"
            fill="none"
            stroke="#526776"
            strokeWidth="9"
            strokeLinejoin="round"
          />
          {[132, 165, 228, 250, 307, 335].map((x, i) => (
            <rect
              key={x}
              x={x}
              y={i < 2 ? 145 : 164}
              width="13"
              height="23"
              rx="3"
              fill="#fcf5df"
            />
          ))}
          <path
            d="M119 279Q219 188 322 279M120 279H320"
            fill="none"
            stroke="#547381"
            strokeWidth="13"
          />
          <path d="M218 232V280" stroke="#547381" strokeWidth="7" />
          <circle cx="333" cy="70" r="23" fill="#f4cf6d" />
        </>
      )}
      {id === "school" && (
        <>
          <rect
            x="244"
            y="91"
            width="103"
            height="164"
            rx="28"
            transform="rotate(12 244 91)"
            fill="#8e9d7f"
          />
          <path
            d="M265 102V84Q285 56 310 92V109"
            fill="none"
            stroke="#50644f"
            strokeWidth="9"
          />
          <rect x="267" y="170" width="61" height="54" rx="10" fill="#b7c39d" />
          <path
            d="M77 153Q147 127 210 155Q247 143 276 163L253 282Q213 256 179 273Q123 250 65 272Z"
            fill="#fff9e7"
            stroke="#b6a4b8"
            strokeWidth="5"
          />
          <path
            d="M210 157L179 269M95 178L181 184M91 199L173 207M87 222L166 230M225 180L253 185M218 202L248 209"
            stroke="#c6bdc6"
            strokeWidth="3"
          />
          <g transform="rotate(22 160 95)">
            <rect
              x="150"
              y="47"
              width="18"
              height="153"
              rx="5"
              fill="#e9b853"
            />
            <path d="M150 200L159 224L168 200" fill="#5e566b" />
          </g>
          <text x="62" y="93" fontSize="26" fill="#8a78a3">
            Аа
          </text>
        </>
      )}
      {id === "weekend" && (
        <>
          <g transform="rotate(-12 168 140)">
            <rect
              x="72"
              y="75"
              width="187"
              height="151"
              rx="17"
              fill="#fff8e1"
              stroke="#c4a15b"
              strokeWidth="4"
            />
            <path d="M74 115H255" stroke="#eaa07e" strokeWidth="30" />
            <text x="110" y="182" fontSize="44" fill="#73623f">
              СБ
            </text>
          </g>
          <g transform="rotate(12 286 199)">
            <rect
              x="203"
              y="157"
              width="161"
              height="109"
              rx="20"
              fill="#748ca0"
            />
            <path d="M246 157L257 139H310L320 157" fill="#536a81" />
            <circle cx="284" cy="211" r="36" fill="#d9e4df" />
            <circle cx="284" cy="211" r="24" fill="#465b6d" />
            <circle cx="276" cy="203" r="8" fill="#95b9c2" />
            <rect
              x="216"
              y="175"
              width="22"
              height="12"
              rx="3"
              fill="#f2ce7e"
            />
          </g>
          <path
            d="M320 78l7 16l17 3l-13 12l3 17l-15-8l-15 8l3-17l-13-12l18-3Z"
            fill="#e8b257"
          />
        </>
      )}
      {id === "guest" && (
        <>
          <path
            d="M63 216L120 97L206 117L284 84L366 109L324 249L239 231L153 263Z"
            fill="#f5edcf"
            stroke="#c9c19f"
            strokeWidth="3"
          />
          <path
            d="M120 97L153 263M206 117L239 231M102 187Q148 140 210 182T327 140"
            fill="none"
            stroke="#b9cbb2"
            strokeWidth="12"
          />
          <g transform="rotate(11 263 200)">
            <rect
              x="201"
              y="146"
              width="122"
              height="132"
              rx="18"
              fill="#e49a85"
            />
            <path
              d="M237 147V126H281V147M223 151V271M299 152V270"
              fill="none"
              stroke="#9b6059"
              strokeWidth="7"
            />
            <rect
              x="247"
              y="184"
              width="40"
              height="32"
              rx="5"
              fill="#ffe4a4"
            />
          </g>
          <g transform="rotate(-9 115 100)">
            <rect
              x="55"
              y="68"
              width="153"
              height="58"
              rx="12"
              fill="#d4d5f4"
            />
            <text
              x="132"
              y="104"
              textAnchor="middle"
              fontSize="23"
              fill="#5a547d"
            >
              Привет!
            </text>
          </g>
          <path d="M321 53L377 69L331 88L337 73Z" fill="#719eac" />
        </>
      )}
      <path
        d="M65 292h20m-10-10v20M368 190h16m-8-8v16"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".6"
      />
    </svg>
  );
}
export function ZinaArt() {
  return (
    <svg
      viewBox="0 0 300 320"
      role="img"
      aria-label="Баба Зина, a fictional grandmother knitting with purple yarn"
      className="zina-art"
    >
      <ellipse cx="150" cy="297" rx="110" ry="13" fill="#d8d0c3" />
      <path
        d="M65 281V166Q150 121 237 172V281"
        className="zina-cardigan"
        fill="#824452"
      />
      <path d="M90 270L90 197Q150 174 209 199L213 272" fill="#79877b" />
      <path d="M91 100Q80 21 150 20T219 100" fill="#c8c8c5" />
      <circle cx="150" cy="30" r="24" fill="#c8c8c5" />
      <path
        d="M101 94Q150 43 202 94L198 145Q181 178 151 178T103 144Z"
        fill="#efc6a6"
      />
      <path d="M98 98Q105 51 154 61Q176 85 204 91" fill="#dad8d1" />
      <g className="zina-glasses">
        <ellipse
          cx="126"
          cy="113"
          rx="23"
          ry="18"
          fill="#faf5df"
          fillOpacity=".35"
          stroke="#51495c"
          strokeWidth="4"
        />
        <ellipse
          cx="177"
          cy="113"
          rx="23"
          ry="18"
          fill="#faf5df"
          fillOpacity=".35"
          stroke="#51495c"
          strokeWidth="4"
        />
        <path
          d="M149 110H154M99 109H106M199 109H208"
          stroke="#51495c"
          strokeWidth="4"
        />
        <circle cx="127" cy="115" r="3" fill="#51495c" />
        <circle cx="177" cy="115" r="3" fill="#51495c" />
      </g>
      <path
        className="zina-brow"
        d="M165 89Q178 81 189 90"
        fill="none"
        stroke="#766858"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M140 150Q152 157 166 148"
        fill="none"
        stroke="#ac7568"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M149 119L145 133L155 135"
        fill="none"
        stroke="#cd9d85"
        strokeWidth="3"
      />
      <path
        className="zina-arms"
        d="M87 203Q117 232 148 233M216 203Q190 235 164 230"
        fill="none"
        stroke="#efc6a6"
        strokeWidth="21"
        strokeLinecap="round"
      />
      <g className="knitting">
        <path
          d="M135 201L186 262M183 201L132 262"
          stroke="#e4bd7f"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M134 239Q158 226 182 239L182 280H134Z" fill="#cab4db" />
        <path
          d="M139 244l8 8l8-8l8 8l8-8M139 260l8 8l8-8l8 8l8-8"
          fill="none"
          stroke="#a18ab4"
          strokeWidth="3"
        />
      </g>
      <g className="zina-red-pen">
        <path
          d="M218 204L263 91"
          stroke="#bd3e40"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path d="M261 96L271 72L274 102" fill="#4c3842" />
      </g>
      <path d="M221 280L225 309H279L285 280Z" fill="#b88c5b" />
      <path d="M225 288H280M229 298H278" stroke="#e2bd87" strokeWidth="3" />
      <circle cx="251" cy="282" r="23" fill="#ba9bd0" />
      <path
        d="M234 272l34 15m-37-3l32 13m-13-35l-6 40M230 285Q214 306 184 286"
        fill="none"
        stroke="#8d74a6"
        strokeWidth="2"
      />
    </svg>
  );
}
