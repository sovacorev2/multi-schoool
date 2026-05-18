/**
 * Email service for sending notifications to teachers
 * Uses Resend or another email service
 */

interface TeacherEmailData {
  first_name: string
  last_name: string
  email: string
  pin: string
  school_name: string
  assigned_classes: Array<{ class_name: string; subjects: string[] }>
  welcome_password: string
}

export async function sendTeacherWelcomeEmail(data: TeacherEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const assignmentsHTML = data.assigned_classes
      .map(
        assignment => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${assignment.class_name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${assignment.subjects.join(', ') || 'All Subjects'}</td>
        </tr>
      `,
      )
      .join('')

    const emailHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; }
          .content { margin: 20px 0; }
          .pin-box { background-color: #f0f0f0; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0; }
          .pin-number { font-size: 36px; font-weight: bold; color: #3498db; letter-spacing: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th { background-color: #3498db; color: white; padding: 10px; text-align: left; }
          .warning { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107; }
          .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ShuleTech ${data.school_name}! 👋</h1>
          </div>

          <div class="content">
            <p>Dear <strong>${data.first_name} ${data.last_name}</strong>,</p>
            
            <p>Your teacher account has been created and activated. You can now access the examination system to enter and manage learner marks.</p>

            <div class="pin-box">
              <p><strong>YOUR UNIQUE ACCESS PIN:</strong></p>
              <div class="pin-number">${data.pin}</div>
              <p style="margin: 10px 0 0 0; color: #666;">Use this PIN to log in to your teacher portal</p>
            </div>

            <h3>Login Credentials:</h3>
            <ul>
              <li><strong>Welcome Password:</strong> ${data.welcome_password}</li>
              <li><strong>Your PIN:</strong> ${data.pin}</li>
              <li><strong>Login URL:</strong> ShuleExams Portal (on main dashboard)</li>
            </ul>

            <h3>Your Class and Subject Assignments:</h3>
            <table>
              <tr>
                <th>Class</th>
                <th>Subject(s)</th>
              </tr>
              ${assignmentsHTML}
            </table>

            <div class="warning">
              <h4 style="margin: 0 0 10px 0;">⚠️ IMPORTANT SECURITY REMINDER</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Do not share your PIN</strong> with anyone, including other teachers or learners</li>
                <li><strong>Do not lose your PIN</strong> - it's your unique identifier in the system</li>
                <li>If you forget your PIN, contact your school admin to reset it</li>
                <li>Keep your PIN confidential to protect learner data</li>
              </ul>
            </div>

            <h3>How to Access the System:</h3>
            <ol>
              <li>Go to the teacher login page</li>
              <li>Enter the Welcome Password: <strong>${data.welcome_password}</strong></li>
              <li>Enter your PIN: <strong>${data.pin}</strong></li>
              <li>Select your school and click login</li>
              <li>You'll see only the classes and subjects assigned to you</li>
            </ol>

            <p>If you have any questions or need assistance, please contact your school administration.</p>

            <p>Best regards,<br><strong>ShuleTech Examination System</strong></p>
          </div>

          <div class="footer">
            <p>This email contains sensitive information. Please keep it safe and secure.</p>
            <p>Sent on behalf of ${data.school_name}</p>
          </div>
        </div>
      </body>
    </html>
    `

    // For now, we'll log this - in production, integrate with email service
    console.log('[v0] Email would be sent to:', data.email)
    console.log('[v0] Email subject: Welcome to ShuleTech - Your Access PIN and Assignment')

    // TODO: Integrate with actual email service (Resend, SendGrid, etc.)
    // const response = await resend.emails.send({
    //   from: 'shuletech1@gmail.com',
    //   to: data.email,
    //   subject: 'Welcome to ShuleTech - Your Access PIN and Assignment',
    //   html: emailHTML,
    // })

    return { success: true }
  } catch (error) {
    console.error('[v0] Error sending email:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

export async function sendPINResetEmail(
  email: string,
  pin: string,
  schoolName: string,
  welcomePassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const emailHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #e74c3c; color: white; padding: 20px; border-radius: 5px; }
          .pin-box { background-color: #f0f0f0; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0; }
          .pin-number { font-size: 36px; font-weight: bold; color: #e74c3c; letter-spacing: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>PIN Reset - ShuleTech ${schoolName}</h1>
          </div>

          <p>Your PIN has been reset by your school administrator.</p>

          <div class="pin-box">
            <p><strong>YOUR NEW PIN:</strong></p>
            <div class="pin-number">${pin}</div>
          </div>

          <p><strong>Welcome Password:</strong> ${welcomePassword}</p>

          <p>Please use this new PIN to access the system. Keep it safe and confidential.</p>

          <p>If you did not request this reset, please contact your school administration immediately.</p>
        </div>
      </body>
    </html>
    `

    console.log('[v0] PIN reset email would be sent to:', email)

    return { success: true }
  } catch (error) {
    console.error('[v0] Error sending PIN reset email:', error)
    return { success: false, error: 'Failed to send email' }
  }
}
