#!/usr/bin/perl
# Create Poly files (https://wiki.openstreetmap.org/wiki/Osmosis/Polygon_Filter_File_Format) from GeoJSON files

use strict;
use warnings;
use JSON::XS;
use Data::Dumper;

my ($dir,@files,$cc,$simple,$f);
$dir = $ARGV[0];

if(!-d $dir){
	print "Please specify a valid directory to process.\n";
	exit;
}
opendir(DIR,$dir) or die "Couldn't open directory, $!";
while ($cc = readdir DIR){
	if($cc =~ /\.geojson$/){
		$simple = $cc;
		$simple =~ s/\.geojson$/\.simple/;
		if(-e $dir."/".$simple){
			$cc = $simple;
		}
		push(@files,$dir."/".$cc);
	}
}
closedir(DIR);
print @files;


foreach $f (@files){
	print "Polyify $f\n";
	polyify($f);
}

sub polyify {

	my (@lines,$name,$coder,$str,$json,$file,@features,@feature,$nf,$n,$f,@polygons,$npoly,$p,@parts,$pt,$npt,$poly,@coords,$c,$polyfile);

	$file = $_[0];

	print "Opening $file\n";
	open(GEOJSON,$file);
	@lines = <GEOJSON>;
	close(GEOJSON);
	$str = join("",@lines);

	$coder = JSON::XS->new->utf8->canonical(1);

	$json = $coder->decode($str);
	@features = @{$json->{'features'}};
	$n = @features;

	$name = $file;
	$name =~ s/\.[^\.]*$//;
	$name =~ s/[\/]/\_/g;
	$polyfile = $file;
	$polyfile =~ s/\.[^\.]*$//;
	$polyfile .= ".poly";

	$poly = "$name\n";
	print "$n features\n";
	if($n > 0){
		for($f = 0; $f < $n; $f++){
			# If this feature is a MultiPolygon
			if($features[$f]{'geometry'}{'type'} eq "MultiPolygon"){
				@feature = @{$features[$f]{'geometry'}{'coordinates'}};
				$nf = @feature;
				print "\tnf = $nf\n";
				for($p = 0; $p < $nf; $p++){
					@parts = @{$features[$f]{'geometry'}{'coordinates'}[$p]};
					$npt = @parts;
					for($pt = 0; $pt < $npt; $pt++){
						if($pt > 0){
							# Prefix for a hole
							$poly .= "!";
						}
						$poly .= "polygon\_$f\_$p\_$pt\n";
						@coords = @{$features[$f]{'geometry'}{'coordinates'}[$p][$pt]};
						# Print all the coordinates for this part
						for($c = 0; $c < @coords; $c++){
							$poly .= "\t".$coords[$c][0]."\t".$coords[$c][1]."\n";
						}
						$poly .= "END\n";
					}
				}
			}elsif($features[$f]{'geometry'}{'type'} eq "Polygon"){
				@feature = @{$features[$f]{'geometry'}{'coordinates'}};
				$nf = @feature;
				print "\tnf = $nf\n";
				for($p = 0; $p < $nf; $p++){
					if($p > 0){
						# Prefix for a hole
						$poly .= "!";
					}
					$poly .= "polygon\_$f\_$p\n";
					@coords = @{$features[$f]{'geometry'}{'coordinates'}[$p]};
					$npt = @parts;
					print "\t\tnpt = $npt\n";
					# Print all the coordinates for this part
					for($c = 0; $c < @coords; $c++){
						$poly .= "\t".$coords[$c][0]."\t".$coords[$c][1]."\n";
					}
					$poly .= "END\n";
				}
			}else{
				print "Unknown type\n";
			}
		}
	}
	$poly .= "END\n";

	print "Saving to $polyfile\n";
	open(FILE,">",$polyfile);
	print FILE $poly;
	close(FILE);
}