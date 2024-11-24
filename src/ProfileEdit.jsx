import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import './profileEdit.css'; // Optional: Add styling for the component

const ProfileEdit = () => {
  const { currentUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(''); // To show the user's email
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [isEditing, setIsEditing] = useState(false); // Toggle between View and Edit modes

  useEffect(() => {
    const fetchUserProfile = async () => {
      const db = getFirestore();
      const userDoc = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userDoc);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setDisplayName(data.displayName || '');
        setEmail(currentUser.email); // Use Firebase Auth for the email
        setProfilePicUrl(data.profilePicUrl || '');
      }
    };

    fetchUserProfile();
  }, [currentUser]);

  const handleProfilePicChange = (e) => {
    if (e.target.files[0]) {
      setProfilePic(e.target.files[0]);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const db = getFirestore();
    const userDoc = doc(db, 'users', currentUser.uid);
    const updates = { displayName };

    if (profilePic) {
      const storage = getStorage();
      const storageRef = ref(storage, `profilePics/${currentUser.uid}`);
      await uploadBytes(storageRef, profilePic);
      const downloadURL = await getDownloadURL(storageRef);
      updates.profilePicUrl = downloadURL;
      setProfilePicUrl(downloadURL);
    }

    await updateDoc(userDoc, updates);
    alert('Profile updated successfully!');
    setIsEditing(false); // Switch back to View mode after saving
  };

  return (
    <div className="profile-edit">
      <h2>{isEditing ? 'Edit Profile' : 'Your Profile'}</h2>
      <div className="profile-view">
        {/* Profile Picture */}
        {profilePicUrl && (
          <div>
            <img src={profilePicUrl} alt="Profile" width="100" />
          </div>
        )}

        {/* View Mode */}
        {!isEditing && (
          <div>
            <p><strong>Display Name:</strong> {displayName}</p>
            <p><strong>Email:</strong> {email}</p>
            <button onClick={() => setIsEditing(true)}>Edit Profile</button>
          </div>
        )}

        {/* Edit Mode */}
        {isEditing && (
          <form onSubmit={handleSave}>
            <label>
              Display Name:
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label>
              Profile Picture:
              <input type="file" onChange={handleProfilePicChange} />
            </label>
            <button type="submit">Save Changes</button>
            <button type="button" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfileEdit;

