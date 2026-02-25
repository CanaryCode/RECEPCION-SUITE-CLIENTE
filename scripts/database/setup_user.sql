DROP USER IF EXISTS 'hotel_user'@'localhost';
CREATE USER 'hotel_user'@'localhost' IDENTIFIED BY 'Gravina82+';
GRANT ALL PRIVILEGES ON hotel_manager.* TO 'hotel_user'@'localhost';
FLUSH PRIVILEGES;
