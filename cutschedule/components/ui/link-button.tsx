"use client"

import * as React from "react"
import Link from "next/link"
import { Button, type ButtonProps } from "@/components/ui/button"

type LinkButtonProps = Omit<ButtonProps, "asChild"> & {
  href: string
  prefetch?: boolean
  target?: string
  rel?: string
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
