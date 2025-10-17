import { Metadata } from 'next'
import { formatETDateLong } from '@/lib/utils/timezone'

// Update only when Privacy Policy changes
const PRIVACY_POLICY_EFFECTIVE_DATE = new Date('2025-10-17')

export const metadata: Metadata = {
  title: 'Privacy Policy - CutSchedule',
  description: 'Privacy Policy for CutSchedule appointment booking service',
}

export default function PrivacyPolicy() {
  return (
    <div className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-6">Effective Date: {formatETDateLong(PRIVACY_POLICY_EFFECTIVE_DATE)}</p>

        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="mb-3">When you book an appointment through CutSchedule, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your name</li>
              <li>Phone number</li>
              <li>Appointment date and time preferences</li>
              <li>Google account information (for admin access only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Schedule and manage your appointments</li>
              <li>Send appointment confirmations and reminders via SMS</li>
              <li>Contact you if we need to reschedule</li>
              <li>Improve our booking services</li>
              <li>Sync appointments with Google Calendar (admin only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
            <p className="mb-3">We do not sell, trade, or rent your personal information. We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Twilio - for sending SMS notifications</li>
              <li>Google Calendar - for appointment management (admin access only)</li>
              <li>Vercel - our hosting provider</li>
            </ul>
            <p className="mt-3">All third-party services are required to protect your information and use it only for providing their services.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Security</h2>
            <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Your data is stored securely in encrypted databases and transmitted over secure HTTPS connections.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. SMS Communications</h2>
            <p className="mb-3">By providing your phone number, you consent to receive:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Appointment confirmation messages</li>
              <li>Reminder messages (24 hours and 1 hour before your appointment)</li>
              <li>Rescheduling notifications if necessary</li>
            </ul>
            <p className="mt-3">Message and data rates may apply. You can opt out of SMS messages by replying STOP to any message.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p>We retain your appointment information for business records and to provide you with better service on future visits. You may request deletion of your personal information by contacting us.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access your personal information</li>
              <li>Request corrections to your information</li>
              <li>Request deletion of your information</li>
              <li>Opt out of SMS communications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p>We use essential cookies to maintain your session and ensure the booking system functions properly. We also use authentication cookies for admin access through Google OAuth.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children&apos;s Privacy</h2>
            <p>Our services are not directed to individuals under the age of 13. We do not knowingly collect personal information from children under 13.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the effective date.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact Us</h2>
            <p className="mb-3">If you have any questions about this Privacy Policy, please contact us at:</p>
            <ul className="list-none space-y-1">
              <li>Phone: (385) 206-8094</li>
              <li>Address: Salt Lake City, UT</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
