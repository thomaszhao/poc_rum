
all:
	@echo "please just excute: sudo make install"

install:
	ln -sf $(shell pwd)/conf/rum.conf	 /etc/nginx/sites-enabled/rum.conf
	ln -sf $(shell pwd)/../poc_rum    	 /usr/share/nginx/html/rum

