bundle: 
	@head=$$(git log | head -n 1); \ 
	partialHash=$${head:7:10}; \ 
	mkdir -p bundles; \ 
	if [ -f ./bundles/"$$partialHash".bundle ]; then \ 
		echo "The file exists."; \ 
		exit 0; \ 
	fi; \ 
	git bundle create ./bundles/"$$partialHash".bundle HEAD main;