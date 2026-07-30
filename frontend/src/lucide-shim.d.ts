declare module 'lucide-react/dist/esm/icons/*' {
  import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'

  const Icon: ForwardRefExoticComponent<
    Omit<SVGProps<SVGSVGElement>, 'ref'> & {
      size?: string | number
      absoluteStrokeWidth?: boolean
    } & RefAttributes<SVGSVGElement>
  >

  export default Icon
}
