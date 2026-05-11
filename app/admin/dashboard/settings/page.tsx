"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { 
  Key, 
  Lock, 
  Unlock, 
  RotateCcw,
  Shield,
  Save,
  Eye,
  EyeOff
} from "lucide-react"
import { 
  getClassesForPasswordManagement, 
  resetClassPassword,
  changeAdminPassword 
} from "@/app/actions/auth"
import { schoolConfig, LOWER_GRADE_CLASSES } from "@/lib/school-config"
import SchoolLogoUploader from "@/components/admin/SchoolLogoUploader"
import { useCallback } from "react"

export default function AdminSettingsPage() {
  const [classPasswords, setClassPasswords] = useState<{ id: string; name: string; hasPassword: boolean }[]>([])
  const [passwordResetLoading, setPasswordResetLoading] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [schoolLogo, setSchoolLogo] = useState<string | undefined>(undefined)
  
  // Admin password change
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Reset confirmation
  const [resetConfirm, setResetConfirm] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    async function fetchData() {
      const passwords = await getClassesForPasswordManagement()
      setClassPasswords(passwords)
      
      // Get school info from localStorage or fetch
      const school = localStorage.getItem('school')
      if (school) {
        const schoolData = JSON.parse(school)
        setSchoolId(schoolData.id)
        setSchoolName(schoolData.name)
        setSchoolLogo(schoolData.logo_url)
      }
      
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const handleLogoUploadSuccess = useCallback((logoUrl: string) => {
    setSchoolLogo(logoUrl)
    if (schoolId && schoolName) {
      const schoolData = { id: schoolId, name: schoolName, logo_url: logoUrl }
      localStorage.setItem('school', JSON.stringify(schoolData))
    }
  }, [schoolId, schoolName])

  const lowerClassPasswords = classPasswords.filter(c => 
    LOWER_GRADE_CLASSES.some(grade => c.name.includes(grade))
  )

  const handleResetPassword = async (classId: string) => {
    setPasswordResetLoading(classId)
    const result = await resetClassPassword(classId)
    
    if (result.success) {
      const updatedPasswords = await getClassesForPasswordManagement()
      setClassPasswords(updatedPasswords)
    }
    
    setPasswordResetLoading(null)
    setResetConfirm(null)
  }

  const handleChangeAdminPassword = async () => {
    setPasswordMessage(null)
    
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }
    
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' })
      return
    }
    
    setPasswordChangeLoading(true)
    const result = await changeAdminPassword(currentPassword, newPassword)
    
    if (result.success) {
      setPasswordMessage({ type: 'success', text: 'Admin password changed successfully' })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } else {
      setPasswordMessage({ type: 'error', text: result.error || 'Failed to change password' })
    }
    
    setPasswordChangeLoading(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-gray-500">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage system settings and passwords</p>
      </div>

      {/* School Logo Upload */}
      {schoolId && schoolName && (
        <Card>
          <CardHeader>
            <CardTitle>School Logo</CardTitle>
            <CardDescription>
              Upload and manage your school&apos;s logo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SchoolLogoUploader
              schoolId={schoolId}
              schoolName={schoolName}
              currentLogoUrl={schoolLogo}
              onUploadSuccess={handleLogoUploadSuccess}
            />
          </CardContent>
        </Card>
      )}

      {/* Admin Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Change Admin Password
          </CardTitle>
          <CardDescription>
            Update the admin login password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordMessage && (
            <div className={`p-3 rounded-lg text-sm ${
              passwordMessage.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {passwordMessage.text}
            </div>
          )}
          
          <div className="grid gap-4 max-w-md">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            
            <Button 
              onClick={handleChangeAdminPassword}
              disabled={passwordChangeLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-fit"
            >
              {passwordChangeLoading ? "Changing..." : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teacher Password Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Teacher Password Management
          </CardTitle>
          <CardDescription>
            Reset passwords for PP1 to Grade 3 classes. Grade 4-9 use a common password ({schoolConfig.defaultTeacherPassword}).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-4">
            <strong>Note:</strong> When you reset a password, the teacher will need to set a new password on their next login.
          </div>
          
          {lowerClassPasswords.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No lower grade classes found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Password Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowerClassPasswords.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>
                      {cls.hasPassword ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <Lock className="w-3 h-3 mr-1" />
                          Password Set
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600">
                          <Unlock className="w-3 h-3 mr-1" />
                          Not Set
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {cls.hasPassword && (
                        resetConfirm?.id === cls.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-red-600">Confirm?</span>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleResetPassword(cls.id)}
                              disabled={passwordResetLoading === cls.id}
                            >
                              {passwordResetLoading === cls.id ? "Resetting..." : "Yes, Reset"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setResetConfirm(null)}
                              className="bg-transparent"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResetConfirm({ id: cls.id, name: cls.name })}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reset Password
                          </Button>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
