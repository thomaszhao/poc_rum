
all:
	@echo "please just excute: sudo make install"

install:
	ln -sf $(shell pwd)/conf/rum.conf	 /etc/nginx/sites-enabled/rum.conf
	ln -sf $(shell pwd)/    	 /usr/share/nginx/html/rum

