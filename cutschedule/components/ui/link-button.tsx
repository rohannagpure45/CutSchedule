"use client"

import * as React from "react"
import Link from "next/link"
import { Button, type ButtonProps } from "@/components/ui/button"

type NextLinkProps = React.ComponentProps<typeof Link>

type LinkButtonProps = Omit<ButtonProps, "asChild"> & {
  href: NextLinkProps["href"]
  prefetch?: NextLinkProps["prefetch"]
  target?: React.AnchorHTMLAttributes<HTMLAnchorElement>["target"]
  rel?: React.AnchorHTMLAttributes<HTMLAnchorElement>["rel"]
}

export function LinkButton({ href, prefetch, target, rel, children, ...buttonProps }: LinkButtonProps) {
  return (
    <Button asChild {...buttonProps}>
      <Link href={href} prefetch={prefetch} target={target} rel={rel}>
        {children}
      </Link>
    </Button>
  )
}
