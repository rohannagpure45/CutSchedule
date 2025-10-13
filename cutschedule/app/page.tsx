import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, CheckSquare, RotateCcw, MapPin, Instagram } from "lucide-react"
import { APP_CONFIG } from "@/lib/constants"

// Test deployment with Root Directory set to cutschedule

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold mb-6">
          Neil&apos;s Barbershop
        </h1>
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          Professional barber services with easy online booking, automated reminders,
          and flexible rescheduling. Get the perfect cut on your schedule.
        </p>
        <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
          <Button size="lg" className="w-full sm:w-auto" asChild>
            <Link href="/book">Book Appointment</Link>
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
            <Link href="/gallery">View Gallery</Link>
          </Button>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an appointment?{" "}
            <Link href="/manage-appointment" className="text-primary hover:underline font-medium">
              Manage it here
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Easy Booking</CardTitle>
            <CardDescription>
              Schedule your appointment in just a few clicks. Select your preferred date and time.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <CheckSquare className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-lg">Smart Reminders</CardTitle>
            <CardDescription>
              Get SMS reminders so you never miss your appointment. 24-hour and 1-hour notifications.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Flexible Rescheduling</CardTitle>
            <CardDescription>
              Need to change your appointment? Reschedule or cancel easily with your unique link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Business Information Section */}
      <div className="mt-16 max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Visit Us</CardTitle>
            <CardDescription>
              Located in the heart of the city, providing quality cuts since day one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold">Address</h3>
                <p className="text-sm text-muted-foreground">{APP_CONFIG.BARBER_ADDRESS}</p>
              </div>

              <div className="flex flex-col items-center space-y-2">
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Instagram className="w-6 h-6 text-pink-600" />
                </div>
                <h3 className="font-semibold">Instagram</h3>
                <p className="text-sm text-muted-foreground">@kerr_blendz</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA Section */}
      <div className="mt-16 text-center">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="text-3xl">Ready for Your Next Cut?</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Book your appointment now and experience professional service with convenient scheduling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/book">Schedule Now</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}