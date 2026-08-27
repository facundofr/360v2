const logoUrl = new URL("../../assets/logo.png", import.meta.url).href

type LogoProps = {
  className?: string
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <span className={`relative inline-block leading-none shrink-0 ${className}`}>
      <img
        src={logoUrl}
        alt="Cober360"
        className="block h-full w-auto invert dark:invert-0"
      />
    </span>
  )
}
