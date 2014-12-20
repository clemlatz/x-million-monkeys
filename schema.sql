# ************************************************************
# Sequel Pro SQL dump
# Version 4135
#
# http://www.sequelpro.com/
# http://code.google.com/p/sequel-pro/
#
# Host: localhost (MySQL 5.5.38)
# Database: xmm
# Generation Time: 2014-12-20 06:03:09 +0000
# ************************************************************


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


# Dump of table inputs
# ------------------------------------------------------------

CREATE TABLE `inputs` (
  `input_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `monkey_token` varchar(32) DEFAULT NULL,
  `page_id` int(10) unsigned DEFAULT NULL,
  `page_version` int(10) unsigned DEFAULT NULL,
  `input_content` varchar(32) DEFAULT NULL,
  `input_status` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `input_insert` datetime DEFAULT NULL,
  `input_update` datetime DEFAULT NULL,
  PRIMARY KEY (`input_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;



# Dump of table monkeys
# ------------------------------------------------------------

CREATE TABLE `monkeys` (
  `monkey_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `monkey_online` tinyint(1) NOT NULL DEFAULT '0',
  `monkey_token` varchar(32) DEFAULT NULL,
  `monkey_ip` varchar(45) DEFAULT NULL,
  `page_id` int(11) DEFAULT NULL,
  `monkey_seen` datetime DEFAULT NULL,
  `monkey_insert` datetime DEFAULT NULL,
  `monkey_update` datetime DEFAULT NULL,
  PRIMARY KEY (`monkey_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;



# Dump of table pages
# ------------------------------------------------------------

CREATE TABLE `pages` (
  `page_id` int(10) NOT NULL AUTO_INCREMENT,
  `page_content` longtext CHARACTER SET latin1,
  `page_last_player` varchar(32) CHARACTER SET latin1 DEFAULT NULL,
  `page_version` int(10) unsigned NOT NULL DEFAULT '1',
  `page_timestamp` bigint(20) unsigned DEFAULT NULL,
  `page_theme` varchar(32) NOT NULL,
  `page_theme_words` int(10) unsigned NOT NULL DEFAULT '100',
  `page_insert` datetime DEFAULT NULL,
  `page_update` datetime DEFAULT NULL,
  PRIMARY KEY (`page_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;




/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
