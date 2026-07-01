document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs (Announcements vs Chat)
  const navAnnouncements = document.getElementById('navAnnouncements');
  const navChat = document.getElementById('navChat');
  const announcementsView = document.getElementById('announcementsView');
  const chatView = document.getElementById('chatView');
  const topbarTitle = document.getElementById('topbarTitle');
  const channelItems = document.querySelectorAll('.channel-item');

  function switchView(view) {
    if (view === 'announcements') {
      navAnnouncements.classList.add('active');
      navChat.classList.remove('active');
      announcementsView.classList.remove('hidden');
      chatView.classList.add('hidden');
      topbarTitle.textContent = 'Announcements, Awards & Birthdays';
      
      // Remove active from channels when in announcements
      channelItems.forEach(ch => ch.classList.remove('active'));
    } else if (view === 'chat') {
      navChat.classList.add('active');
      navAnnouncements.classList.remove('active');
      chatView.classList.remove('hidden');
      announcementsView.classList.add('hidden');
      topbarTitle.textContent = 'Channels & Direct Messages';
    }
  }

  navAnnouncements.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('announcements');
  });

  navChat.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('chat');
    // Default to first channel
    if (!document.querySelector('.channel-item.active')) {
      channelItems[0].classList.add('active');
    }
  });

  channelItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      channelItems.forEach(ch => ch.classList.remove('active'));
      item.classList.add('active');
      switchView('chat');
      document.querySelector('.channel-info h3').textContent = item.textContent;
    });
  });

  // Notification Popover
  const notificationBtn = document.getElementById('notificationBtn');
  const notificationPopover = document.getElementById('notificationPopover');
  const pulseBadge = document.querySelector('.pulse-badge');

  notificationBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notificationPopover.classList.toggle('hidden');
    // Hide pulse when opened
    if (!notificationPopover.classList.contains('hidden')) {
      pulseBadge.style.display = 'none';
    }
  });

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    if (!notificationBtn.contains(e.target) && !notificationPopover.contains(e.target)) {
      notificationPopover.classList.add('hidden');
    }
  });

  // Birthday Pop-up
  const birthdayPopup = document.getElementById('birthdayPopup');
  const closeBirthday = document.getElementById('closeBirthday');

  closeBirthday.addEventListener('click', () => {
    birthdayPopup.classList.add('hidden');
  });

  // Show birthday popup on load for demo
  setTimeout(() => {
    birthdayPopup.classList.remove('hidden');
  }, 1000);

  // Chat interaction simulation
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  const typingIndicator = document.getElementById('typingIndicator');

  function addMessage(text, isSelf = true) {
    const msgGroup = document.createElement('div');
    msgGroup.className = `message-group ${isSelf ? 'right' : ''}`;
    
    let innerHTML = '';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isSelf) {
      innerHTML = `
        <div class="message-content">
          <div class="message-meta">
            <span class="sender">You</span>
            <span class="time">${time}</span>
          </div>
          <div class="message-bubble accent">${text}</div>
        </div>
      `;
    } else {
      innerHTML = `
        <div class="message-avatar">S</div>
        <div class="message-content">
          <div class="message-meta">
            <span class="sender">Sana</span>
            <span class="sender-role">Tech</span>
            <span class="time">${time}</span>
          </div>
          <div class="message-bubble">${text}</div>
        </div>
      `;
    }

    msgGroup.innerHTML = innerHTML;
    // Insert before typing indicator
    chatMessages.insertBefore(msgGroup, typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
      addMessage(chatInput.value.trim(), true);
      chatInput.value = '';
      
      // Simulate reply
      typingIndicator.classList.remove('hidden');
      chatMessages.scrollTop = chatMessages.scrollHeight;
      
      setTimeout(() => {
        typingIndicator.classList.add('hidden');
        addMessage("Got it. I'll update the ticket.", false);
      }, 1500);
    }
  });
});
