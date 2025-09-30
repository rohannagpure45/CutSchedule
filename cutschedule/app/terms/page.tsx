import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service - CutSchedule',
  description: 'Terms of Service for CutSchedule appointment booking service',
}

export default function TermsOfService() {
  return (
    <div className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-6">Effective Date: {new Date().toLocaleDateString()}</p>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>By using CutSchedule to book appointments, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Service Description</h2>
            <p>CutSchedule provides an online appointment booking system for haircut services. The service allows you to view available time slots, book appointments, and receive confirmations and reminders.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Booking Appointments</h2>
            <div className="space-y-3">
              <p>When booking an appointment:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must provide accurate and complete information</li>
                <li>You must provide a valid phone number for confirmations and reminders</li>
                <li>Appointments are subject to availability</li>
                <li>Each appointment is for a 45-minute service duration</li>
                <li>Bookings can be made up to 30 days in advance</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Cancellation Policy</h2>
            <div className="space-y-3">
              <p>To cancel or reschedule your appointment:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Please provide at least 24 hours notice</li>
                <li>Contact us directly at (385) 206-8094</li>
                <li>Repeated no-shows may result in booking restrictions</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. SMS Notifications</h2>
            <div className="space-y-3">
              <p>By providing your phone number, you agree to receive:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Booking confirmation messages</li>
                <li>Appointment reminders (24 hours and 1 hour before)</li>
                <li>Rescheduling notifications when necessary</li>
              </ul>
              <p className="mt-3">Standard message and data rates may apply. Reply STOP to opt out of messages.</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Service Availability</h2>
            <div className="space-y-3">
              <ul className="list-disc pl-6 space-y-1">
                <li>Services are available during posted business hours</li>
                <li>We reserve the right to modify operating hours</li>
                <li>Emergency closures will be communicated via SMS</li>
                <li>The online booking system may experience occasional maintenance</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. User Responsibilities</h2>
            <div className="space-y-3">
              <p>You agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Arrive on time for your scheduled appointment</li>
                <li>Provide accurate contact information</li>
                <li>Not make false or fraudulent bookings</li>
                <li>Treat staff with respect and courtesy</li>
                <li>Follow health and safety guidelines</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Payment</h2>
            <p>Payment for services is due at the time of service. The booking system is for appointment scheduling only and does not process payments.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
            <p>CutSchedule and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service, including but not limited to missed appointments due to technical issues.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Intellectual Property</h2>
            <p>All content on CutSchedule, including text, graphics, logos, and software, is the property of CutSchedule or its content suppliers and is protected by intellectual property laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Privacy</h2>
            <p>Your use of CutSchedule is also governed by our Privacy Policy. Please review our Privacy Policy, which also governs the site and informs users of our data collection practices.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Modifications to Service</h2>
            <p>We reserve the right to modify or discontinue, temporarily or permanently, the service (or any part thereof) with or without notice. We shall not be liable to you or any third party for any modification, suspension, or discontinuance of the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Governing Law</h2>
            <p>These Terms of Service shall be governed by and construed in accordance with the laws of the State of Utah, without regard to its conflict of law provisions.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Changes to Terms</h2>
            <p>We reserve the right to update or change our Terms of Service at any time. We will notify you of any changes by posting the new Terms of Service on this page. Your continued use of the service after any such changes constitutes your acceptance of the new Terms of Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Contact Information</h2>
            <p className="mb-3">For questions about these Terms of Service, please contact us at:</p>
            <ul className="list-none space-y-1">
              <li>Phone: (385) 206-8094</li>
              <li>Location: Salt Lake City, UT</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}