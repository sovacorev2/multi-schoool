/**
 * Email service for teacher notifications
 * 
 * CURRENT: Logs emails to console for testing
 * PRODUCTION: Replace with Resend, SendGrid, Mailgun, or AWS SES
 * 
 * Environment variable needed: EMAIL_SERVICE_API_KEY
 */

interface TeacherAssignment {
  className: string
  subjectName: string
}

interface TeacherEmailData {
  email: string
  firstName: string
  lastName: string
  pin: string
  schoolName: string
  assignments: TeacherAssignment[]
}

/**
 * Send teacher welcome email with PIN and assignments
 * Current implementation: Logs to console for testing
 * Production: Implement with real email service
 */
export async function sendTeacherWelcomeEmail(
  data: TeacherEmailData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { email, firstName, lastName, pin, schoolName, assignments } = data

    // Build assignments table HTML
    const assignmentsHTML = assignments
      .map(
        a => `
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>${a.className}</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;">${a.subjectName}</td>
        </tr>
      `,
      )
      .join('')

    const emailHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px 5px 0 0; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .pin-box { background-color: white; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0; text-align: center; }
          .pin-number { font-size: 48px; font-weight: bold; color: #3498db; letter-spacing: 10px; font-family: monospace; margin: 10px 0; }
          .section { margin: 20px 0; }
          .warning { background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background-color: #3498db; color: white; padding: 10px; text-align: left; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ShuleTech ${schoolName}! 👋</h1>
          </div>

          <div class="content">
            <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
            
            <p>Your teacher account has been successfully created and your class and subject assignments are now active. You can begin accessing the examination system to view and manage learner marks.</p>

            <div class="pin-box">
              <p style="margin: 0 0 10px 0; color: #666;"><strong>YOUR UNIQUE ACCESS PIN:</strong></p>
              <div class="pin-number">${pin}</div>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Use this PIN every time you log in</p>
            </div>

            <div class="section">
              <h3 style="color: #2c3e50;">How to Login</h3>
              <ol>
                <li>Visit the ShuleTech teacher login page</li>
                <li>Select your school: <strong>${schoolName}</strong></li>
                <li>Enter the Welcome Password (provided by your admin)</li>
                <li>Enter your PIN: <strong>${pin}</strong></li>
                <li>Click Login</li>
              </ol>
            </div>

            <div class="section">
              <h3 style="color: #2c3e50;">Your Assigned Classes and Subjects</h3>
              <p>You can view, enter, and edit marks for these classes and subjects:</p>
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Subject</th>
                  </tr>
                </thead>
                <tbody>
                  ${assignmentsHTML}
                </tbody>
              </table>
              <p style="color: #666; font-size: 14px;">Other subjects and classes will appear as read-only in your dashboard.</p>
            </div>

            <div class="warning">
              <h3 style="margin: 0 0 10px 0; color: #856404;">⚠️ IMPORTANT SECURITY NOTICE</h3>
              <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li><strong>NEVER share your PIN</strong> with anyone (other teachers, learners, parents, etc.)</li>
                <li><strong>KEEP your PIN safe</strong> - it identifies you in the system</li>
                <li>If you <strong>forget your PIN</strong>, contact your school administrator immediately</li>
                <li><strong>Protect learner data</strong> - your PIN protects sensitive student information</li>
                <li>If you suspect someone knows your PIN, ask your admin to generate a new one</li>
              </ul>
            </div>

            <div class="section">
              <h3 style="color: #2c3e50;">Need Help?</h3>
              <p>If you have any questions or encounter issues logging in, please contact your school administration team immediately.</p>
              <p style="color: #999; font-size: 12px;">Do not share this email with anyone - it contains your unique PIN.</p>
            </div>

            <p style="margin-top: 30px;">Best regards,<br><strong>ShuleTech Examination System</strong></p>
          </div>

          <div class="footer">
            <p>This email contains sensitive information. Please keep it secure.</p>
            <p>Generated for ${schoolName} - ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </body>
    </html>
    `

    // DEVELOPMENT: Log email details to console
    console.log('')
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║              📧 TEACHER EMAIL NOTIFICATION 📧                  ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log(`TO: ${email}`)
    console.log(`FROM: shuletech1@gmail.com`)
    console.log(`SUBJECT: Welcome to ShuleTech ${schoolName} - Your PIN: ${pin}`)
    console.log('')
    console.log('────────────────────────────────────────────────────────────────')
    console.log(`TEACHER: ${firstName} ${lastName}`)
    console.log(`SCHOOL: ${schoolName}`)
    console.log(`PIN: ${pin}`)
    console.log('')
    console.log('ASSIGNED CLASSES AND SUBJECTS:')
    assignments.forEach(a => {
      console.log(`  ✓ ${a.className} - ${a.subjectName}`)
    })
    console.log('')
    console.log('────────────────────────────────────────────────────────────────')
    console.log('')

    // PRODUCTION: Integrate with actual email service
    // Options: Resend, SendGrid, Mailgun, AWS SES
    // Example with Resend:
    // if (process.env.RESEND_API_KEY) {
    //   const resend = new Resend(process.env.RESEND_API_KEY)
    //   const response = await resend.emails.send({
    //     from: 'ShuleTech <shuletech1@gmail.com>',
    //     to: email,
    //     subject: `Welcome to ShuleTech ${schoolName} - Your PIN: ${pin}`,
    //     html: emailHTML,
    //   })
    //   return { success: !response.error, error: response.error?.message }
    // }

    return { success: true }
  } catch (error) {
    console.error('[v0] Error preparing email:', error)
    return { success: false, error: 'Failed to prepare email' }
  }
}

export async function sendPINResetEmail(
  email: string,
  pin: string,
  schoolName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('')
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║               🔐 PIN RESET EMAIL NOTIFICATION 🔐               ║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log('')
    console.log(`TO: ${email}`)
    console.log(`FROM: shuletech1@gmail.com`)
    console.log(`SUBJECT: ShuleTech ${schoolName} - PIN Reset`)
    console.log('')
    console.log(`NEW PIN: ${pin}`)
    console.log('')
    console.log('────────────────────────────────────────────────────────────────')
    console.log('')

    return { success: true }
  } catch (error) {
    console.error('[v0] Error preparing PIN reset email:', error)
    return { success: false, error: 'Failed to prepare email' }
  }
}
