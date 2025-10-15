import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default function GalleryPage() {
  const images = [
    { src: "/gallery-1.jpg", alt: "Haircut example 1" },
    { src: "/gallery-2.jpg", alt: "Haircut example 2" },
    { src: "/gallery-3.jpg", alt: "Haircut example 3" },
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
        {images.map((image, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative aspect-square">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
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
