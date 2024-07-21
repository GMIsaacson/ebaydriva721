export const Modal = ({ isOpen, url, onClose }) => {
    if (!isOpen) return null;
  
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <button className="modal-close" onClick={onClose}>×</button>
          <iframe src={url} frameborder="0" width="100%" height="100%" title="Modal Content"></iframe>
        </div>
      </div>
    );
  };

