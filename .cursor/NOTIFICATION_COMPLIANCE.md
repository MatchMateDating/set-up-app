# Notification Security & Legal Compliance Guide

## Current Implementation Status

### ✅ Compliant Practices
1. **Default OFF (Opt-In Required)**: 
   - Database default: `notifications_enabled = False` (line 33 in userDB.py)
   - Frontend initial state: `useState(false)` (line 29 in NotificationContext.js)
   - Users must explicitly opt-in by choosing "Enable" when prompted
   - **This is GDPR/CCPA compliant** - notifications default to OFF, users must explicitly enable
2. **Explicit Opt-In**: Users are prompted to enable notifications after profile completion (not automatically)
3. **User Preference Storage**: `notifications_enabled` flag tracks user consent per user
4. **Token Cleanup**: Push tokens are automatically deleted when user account is deleted (cascade delete)
5. **Per-User Isolation**: Each user's notification preferences are stored separately and isolated

### ⚠️ Areas Requiring Attention

#### 1. Message Content Privacy
**Current Status**: ✅ **FIXED** - Message content removed from notifications
- **Implementation**: Generic "You have a new message" text instead of message preview
- **Location**: `backend/app/services/notification_service.py:137`
- **Compliance**: No sensitive content exposed on lock screens

#### 2. Account Deletion
**Current Status**: ✅ **IMPLEMENTED** - Account deletion endpoint exists
- **Endpoint**: `DELETE /profile/delete_account`
- **Requirement**: Users must be able to delete their account and all associated data
- **Implementation**: 
  - Requires password confirmation for security
  - Deletes all user data (matches, messages, quiz results, skips, blocks, etc.)
  - Push tokens are automatically deleted via cascade delete
  - Handles linked accounts and matchmaker relationships

#### 3. Data Minimization
**Current Status**: Sending sender name, match ID, sender ID in notification data
- **Recommendation**: Only send minimum necessary data (match ID to open conversation)
- **Consider**: Remove sender ID from notification payload if not strictly necessary

#### 4. Token Retention
**Current Status**: Tokens stored indefinitely until user deletes account
- **Best Practice**: Implement token cleanup for:
  - Invalid/expired tokens (when push service reports device not registered)
  - Tokens not used for extended period (e.g., 90 days)
  - User explicitly unregisters device

#### 5. Privacy Policy & Terms
**Required**: Update Privacy Policy and Terms of Service to include:
- What data is collected (push tokens)
- How notifications are used
- User rights (opt-out, delete data)
- Data retention policies

## Legal Requirements by Region

### GDPR (European Union)
- ✅ **Default OFF (Opt-In Required)**: Notifications default to `False`, users must explicitly enable
- ✅ **Explicit consent required**: Users are prompted and must choose "Enable" to opt-in
- ⚠️ Right to be forgotten (verify account deletion works)
- ✅ Data minimization (message content removed from notifications - fixed)
- ⚠️ Privacy policy must explain notification data usage

### CCPA (California)
- ✅ **Default OFF (Opt-In Required)**: Notifications default to `False`, users must explicitly enable
- ✅ **Opt-in consent**: Users are prompted and must choose "Enable" to opt-in
- ⚠️ Right to delete (verify account deletion)
- ⚠️ Disclosure of data collection (update privacy policy)

### COPPA (Children Under 13)
- ✅ Your app requires age 18+ (verified in completeProfile.js)
- ✅ No additional requirements needed

## Recommended Improvements

### Priority 1: Message Content Privacy
```python
# Instead of:
body = message_text[:100] if message_text else "You have a new message"

# Use:
body = "You have a new message"  # Generic, no content preview
```

### Priority 2: Token Cleanup Job
Implement a background job to:
- Remove invalid tokens (when Expo reports DeviceNotRegisteredError)
- Remove tokens unused for 90+ days
- Log cleanup actions for audit

### Priority 3: Account Deletion Endpoint
Ensure users can delete their account and all associated data:
- Push tokens (already handled by cascade delete)
- User profile data
- Messages (if required by law)
- All personal information

### Priority 4: Privacy Policy Updates
Add sections covering:
- Push notification data collection
- How push tokens are used
- Data retention period
- User rights (opt-out, delete)

## Security Best Practices

1. **Encryption**: Push tokens stored in database (ensure database encryption at rest)
2. **Access Control**: Only authenticated users can register/unregister tokens
3. **Rate Limiting**: Implement rate limits on notification endpoints
4. **Audit Logging**: Log when tokens are registered/unregistered
5. **Token Validation**: Validate token format before storing

## Testing Checklist

- [ ] User can opt-in to notifications
- [ ] User can opt-out of notifications
- [ ] User can delete account (verify tokens deleted)
- [ ] Invalid tokens are cleaned up
- [ ] Message notifications don't expose sensitive content
- [ ] Privacy policy explains notification data usage
- [ ] Users can export their data (GDPR requirement)
- [ ] Users can request data deletion (GDPR requirement)
