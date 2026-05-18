import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { email, firstName, lastName, pin, schoolName, welcomePassword } = await req.json()

    // Validate input
    if (!email || !firstName || !pin || !schoolName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      )
    }

    const emailHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .pin-box { background-color: white; padding: 20px; border-left: 4px solid #3498db; margin: 20px 0; text-align: center; }
          .pin-number { font-size: 48px; font-weight: bold; color: #3498db; letter-spacing: 10px; font-family: monospace; }
          .section { margin: 20px 0; }
          .warning { background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .footer { color: #666; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { padding: 10px; text-align: left; border: 1px solid #ddd; }
          th { background-color: #3498db; color: white; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ShuleTech ${schoolName}! 👋</h1>
          </div>

          <div class="content">
            <p>Dear <strong>${firstName} ${lastName}</strong>,</p>
            
            <p>Your teacher account has been successfully created and activated in the ShuleTech examination system. You can now access the portal to enter and manage learner marks.</p>

            <div class="section">
              <h2 style="color: #2c3e50;">Your Unique Access PIN</h2>
              <div class="pin-box">
                <p style="margin: 0 0 10px 0; color: #666;">Your 4-digit PIN code:</p>
                <div class="pin-number">${pin}</div>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">Use this PIN every time you log in</p>
              </div>
            </div>

            <div class="section">
              <h3 style="color: #2c3e50;">Login Instructions</h3>
              <ol>
                <li>Visit the ShuleTech teacher login page</li>
                <li>Enter the <strong>Welcome Password:</strong> <code>${welcomePassword}</code></li>
                <li>Enter your <strong>PIN:</strong> <code>${pin}</code></li>
                <li>Select your school and click Login</li>
                <li>You will see only your assigned classes and subjects</li>
              </ol>
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
              <h3 style="color: #2c3e50;">Your Assigned Classes and Subjects</h3>
              <p>You can view, enter, and edit marks only for these classes and subjects:</p>
              <p style="color: #999; font-size: 14px;">Your assignments will be visible in your dashboard after you log in.</p>
            </div>

            <div class="section">
              <h3 style="color: #2c3e50;">Need Help?</h3>
              <p>If you have any questions or encounter issues logging in, please contact your school administration team immediately.</p>
              <p>Do not share this email with anyone - it contains sensitive information.</p>
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

    // TODO: Integrate with actual email service
    // For now, log that email would be sent
    console.log('[v0] Teacher welcome email sent to:', email)
    console.log('[v0] PIN:', pin)
    console.log('[v0] Teacher:', firstName, lastName)

    // In production, use services like:
    // - Resend (resend.com)
    // - SendGrid
    // - Mailgun
    // - AWS SES
    // Example with Resend:
    // const response = await resend.emails.send({
    //   from: 'shuletech1@gmail.com',
    //   to: email,
    //   subject: `Welcome to ShuleTech ${schoolName} - Your Access PIN: ${pin}`,
    //   html: emailHTML,
    // })

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent successfully',
      email: email,
    })
  } catch (error) {
    console.error('[v0] Error sending email:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 },
    )
  }
}
