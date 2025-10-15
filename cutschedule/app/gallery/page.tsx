"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Play } from "lucide-react"
import { useState } from "react"

type MediaItem = {
  type: 'image' | 'video'
  src: string
  thumbnail?: string
  alt: string
}

function VideoPlayer({ src, thumbnail, alt }: { src: string; thumbnail: string; alt: string }) {
  const [isPlaying, setIsPlaying] = useState(false)

  if (!isPlaying) {
    return (
      <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsPlaying(true)}>
        <Image
          src={thumbnail}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
          <div className="bg-white/90 rounded-full p-4 group-hover:bg-white group-hover:scale-110 transition-all">
            <Play className="w-8 h-8 text-black fill-black" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <video
      src={src}
      controls
      autoPlay
      className="w-full h-full object-cover"
      preload="metadata"
    >
      Your browser does not support the video tag.
    </video>
  )
}

export default function GalleryPage() {
  const mediaItems: MediaItem[] = [
    { type: 'image', src: "/gallery-1.jpg", alt: "Haircut example 1" },
    { type: 'image', src: "/gallery-2.jpg", alt: "Haircut example 2" },
    { type: 'image', src: "/gallery-3.jpg", alt: "Haircut example 3" },
    { type: 'video', src: "/gallery-video-1.mov", thumbnail: "/gallery-video-1-thumb.jpg", alt: "Haircut video 1" },
    { type: 'video', src: "/gallery-video-2.mov", thumbnail: "/gallery-video-2-thumb.jpg", alt: "Haircut video 2" },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with Back Button */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/book">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Booking
          </Link>
        </Button>

        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Gallery</h1>
          <p className="text-lg text-muted-foreground">
            Check out some of our recent work
          </p>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {mediaItems.map((item, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square">
                {item.type === 'image' ? (
                  <Image
                    src={item.src}
                    alt={item.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <VideoPlayer
                    src={item.src}
                    thumbnail={item.thumbnail!}
                    alt={item.alt}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA Section */}
      <div className="mt-12 text-center">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <h2 className="text-2xl font-bold mb-4">Ready for Your Next Cut?</h2>
            <p className="text-muted-foreground mb-6">
              Book your appointment now and get the same quality service
            </p>
            <Button size="lg" asChild>
              <Link href="/book">Book Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
