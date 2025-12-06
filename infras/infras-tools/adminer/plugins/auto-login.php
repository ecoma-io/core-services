<?php

/**
 * Autologin via environment variables
*/
class AdminerAutoLogin {
	var $auth = array("driver" => "", "server" => "", "username" => "", "password" => "", "db" => "");

	function __construct() {
		$this->store_auth();
		if ($_SERVER["REQUEST_URI"] == "/") {
			$_POST["auth"] = $this->auth;
		}
	}

	function store_auth() {
		$this->auth["driver"] = getenv("ADMINER_DRIVER");
		$this->auth["server"] = getenv("ADMINER_SERVER");
		$this->auth["username"] = getenv("ADMINER_USERNAME");
		$this->auth["password"] = getenv("ADMINER_PASSWORD");
		$this->auth["db"] = getenv("ADMINER_DB");
	}

	function credentials() {
		return array($this->auth["server"], $this->auth["username"], $this->auth["password"]);
	}

	function login($login, $password) {
		return true;
	}

	function loginForm() {
		echo "Autologin is enabled.. You should not see this.<br>";
	}
}
