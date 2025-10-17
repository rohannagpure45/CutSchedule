"use client"

import * as React from "react"
import Link, { type LinkProps } from "next/link"
import { Button, type ButtonProps } from "@/components/ui/button"

type LinkButtonProps = Omit<ButtonProps, "asChild"> & {
  href: LinkProps["href"]
  prefetch?: LinkProps["prefetch"]
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
