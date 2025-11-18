1. Remove totally.
2. Accept a file upload object  only except if its an csv.
3. these the are default value of columns mentioned in @improvement-v1.md  by order 
"
0x00009277775ac7d0d59eaad8fee3d10ac6c805e8,0,844.26,1093.71,704785.63,721,89,0,40,118,0.0,45.806785,6.589513,0.0,31.22,1.200681,0.0,0.0,0.0,810,865.6910932,586.4666748,0.0,-279.2244185,265.0,35588543.78,35603169.52,0.0,30.0,54.0,0.0,58.0,0.0,0.0,0.0,0.0,0.0,15000000.0,265586.1476,0.0,16830998.35,271779.92,0.0,0.0,0.0,39.0,57.0,Cofoundit,Numeraire
"
4. Lenient: Accept any CSV and fill in all missing columns with defaults. keep in mind we need to show the necessary column name in the swagger ui and an warning that result quality may decrease if proper column is not present, so if user don't give many columns then its their fault. 

we can also put an checker while inserting in db so that if <50% required column is available we will not insert any data of that csv file.

5. yes.