import React,{useEffect, useState} from 'react';
import './profile.css';
import { FaEdit} from 'react-icons/fa';

const Profile = ({ user, framed, onEditClick }) => {
  const [referralCode, setReferralCode] = useState('');
  // const [editing, setEditing] = useState(false);
  // const [profileData, setProfileData] = useState(user);

  useEffect(() => {
    if (user && user.role === 'user') {
      // If you want to generate it on the frontend:
      const generateReferralCode = () => {
        // You can customize this logic
        const code = `${user.name?.split(' ')[0] || 'user'}-${Math.random().toString(36).substr(2, 6)}`;
        return code.toUpperCase();
      };
      setReferralCode(generateReferralCode());
    }
  }, [user]);

  if (!user) {
    return <div>Loading profile...</div>;
  }

  const {
    name,
    images = [],
    role,
    referral_code,
  } = user;

  // const handleSave = (updated) => {
  //   setProfileData(updated);
  //   setEditing(false);
  // }

  console.log('User data after:', user);
  console.log('User data:', user.referral_code);

  return (
    <div className="profile-container">
      {/* Header */}
      <div className="profile-header">
        {user.role === 'matchmaker' && (<img src={user.avatar || '/default-avatar.png'} alt="Avatar" className="avatar" />)}
        <div className="profile-info">
          <div className="name-section">
            <h2>{name}</h2>
          </div>
          {!framed && (<div className="profile-actions">
            <FaEdit className="edit-icon" onClick={onEditClick}/>
          </div>)}
        </div>
      </div>

      <div className={`profile-card ${framed ? 'framed' : ''}`}>
        {user.age && <p><strong>Age:</strong> {user.age}</p>}
        {user.height && <p><strong>Height:</strong> {user.height}</p>}
        {user.gender && <p><strong>Gender:</strong> {user.gender}</p>}
        {user.description && <p><strong>Description:</strong> {user.description}</p>}
        {user.bio && <p><strong>Bio:</strong> {user.bio}</p>}
      </div>

      {role === 'user' && referral_code && (
        <div>
          <div className="section referral-section">
            <h3>Your Referral Code</h3>
            <div className="referral-code">{referral_code}</div>
          </div>
          <div className="section">
            <h3>Profile</h3>
            <div className="image-grid">
              {images.map((img, index) => (
                <img key={index} src={img.image_url} alt={`Profile ${index}`} className="profile-img" />
              ))}
              {[...Array(9 - images.length)].map((_, index) => (
                <div key={index} className="image-placeholder">
                  <span className="plus-icon">+</span>
                </div>
              ))}
            </div>
          </div>
        </div>  
      )}
    </div>
  );
};

export default Profile;
